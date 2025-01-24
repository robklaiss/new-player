#!/bin/bash

# Set error handling
set -e

# Configuration
KIOSK_DIR="/var/www/kiosk"
HTTP_PORT=8000
LOCK_FILE="/var/run/kiosk/kiosk.pid"
CHROME_FLAGS="
    --kiosk 
    --noerrdialogs 
    --disable-infobars
    --no-sandbox
    --autoplay-policy=no-user-gesture-required
    --disable-gpu-vsync
    --ignore-gpu-blocklist
    --disable-gpu-driver-bug-workarounds
    --enable-gpu-rasterization
    --enable-zero-copy
    --enable-accelerated-video-decode
    --enable-accelerated-mjpeg-decode
    --enable-features=VaapiVideoDecoder
    --disable-features=UseOzonePlatform
    --use-gl=egl
    --enable-hardware-overlays
    --force-device-scale-factor=1
    --disable-background-timer-throttling
    --disable-backgrounding-occluded-windows
    --disk-cache-size=1
    --media-cache-size=1
    --process-per-site
    --single-process
"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
    fi
    pkill -f "chromium.*--app=http://localhost:$HTTP_PORT" || true
    pkill -f "python3 -m http.server $HTTP_PORT" || true
    exit 0
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Ensure lock file directory exists
mkdir -p /var/run/kiosk
chown infoactive:infoactive /var/run/kiosk

# Kill any existing kiosk processes
if [ -f "$LOCK_FILE" ]; then
    OLD_PID=$(cat "$LOCK_FILE")
    if ps -p $OLD_PID > /dev/null 2>&1; then
        log "Killing old kiosk process $OLD_PID"
        kill $OLD_PID || true
        sleep 2
    fi
    rm -f "$LOCK_FILE"
fi

# Kill any stray processes
pkill -f "chromium.*--app=http://localhost:$HTTP_PORT" || true
pkill -f "python3 -m http.server $HTTP_PORT" || true
sleep 2

# Create new lock file
echo $$ > "$LOCK_FILE"

# Start HTTP server
log "Starting HTTP server..."
cd "$KIOSK_DIR"
python3 -m http.server $HTTP_PORT &
HTTP_PID=$!

# Wait for HTTP server to start
sleep 2

# Verify HTTP server is running
if ! kill -0 $HTTP_PID 2>/dev/null; then
    log "Failed to start HTTP server"
    cleanup
    exit 1
fi

# Start Chromium in kiosk mode
log "Starting Chromium in kiosk mode..."
chromium-browser $CHROME_FLAGS --app=http://localhost:$HTTP_PORT/index.html &
CHROME_PID=$!

# Wait for browser to start
sleep 5

# Verify browser started
if ! kill -0 $CHROME_PID 2>/dev/null; then
    log "Failed to start browser"
    cleanup
    exit 1
fi

# Move mouse out of the way
xdotool mousemove 9999 9999

# Monitor processes
while true; do
    if ! kill -0 $$ 2>/dev/null; then
        log "Parent process died, cleaning up"
        cleanup
        exit 1
    fi
    
    if ! pgrep -f "chromium.*--app=http://localhost:$HTTP_PORT" > /dev/null; then
        log "Chromium crashed, restarting..."
        chromium-browser $CHROME_FLAGS --app=http://localhost:$HTTP_PORT/index.html &
        CHROME_PID=$!
        sleep 5
    fi
    
    if ! pgrep -f "python3 -m http.server $HTTP_PORT" > /dev/null; then
        log "HTTP server crashed, restarting..."
        cd "$KIOSK_DIR"
        python3 -m http.server $HTTP_PORT &
        HTTP_PID=$!
        sleep 2
    fi
    
    sleep 5
done