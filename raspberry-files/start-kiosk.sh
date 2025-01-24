#!/bin/bash

# Set error handling
set -e

# Configuration
KIOSK_DIR="/var/www/kiosk"
HTTP_PORT=8000
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

# Create lock file
LOCK_FILE="/tmp/kiosk.lock"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if already running
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p $PID > /dev/null 2>&1; then
        log "Kiosk already running with PID $PID"
        exit 1
    else
        log "Stale lock file found, removing"
        rm -f "$LOCK_FILE"
    fi
fi

# Create lock file with current PID
echo $$ > "$LOCK_FILE"

# Cleanup function
cleanup() {
    log "Cleaning up..."
    pkill -f chromium || true
    pkill -f "python3 -m http.server" || true
    rm -f "$LOCK_FILE"
    exit 0
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Kill any existing instances
pkill -f chromium || true
pkill -f "python3 -m http.server" || true

# Start HTTP server
log "Starting HTTP server..."
cd "$KIOSK_DIR"
python3 -m http.server $HTTP_PORT &

# Wait for HTTP server to start
sleep 2

# Start Chromium in kiosk mode
log "Starting Chromium in kiosk mode..."
chromium-browser \
    $CHROME_FLAGS \
    --app=http://localhost:$HTTP_PORT/index.html &

# Wait for browser to start
sleep 5

# Move mouse out of the way
xdotool mousemove 9999 9999

# Monitor processes
while true; do
    # Check if processes are running
    if ! pgrep -f chromium > /dev/null; then
        log "Chromium crashed, restarting..."
        chromium-browser \
            $CHROME_FLAGS \
            --app=http://localhost:$HTTP_PORT/index.html &
    fi
    
    if ! pgrep -f "python3 -m http.server" > /dev/null; then
        log "HTTP server crashed, restarting..."
        cd "$KIOSK_DIR"
        python3 -m http.server $HTTP_PORT &
    fi
    
    sleep 5
done