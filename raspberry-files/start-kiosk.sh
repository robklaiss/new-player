#!/bin/bash

# Configuration
KIOSK_DIR="/var/www/kiosk"
HTTP_PORT=8000
LOCK_FILE="/var/run/kiosk/kiosk.pid"
DISPLAY=:0
XAUTHORITY=/home/infoactive/.Xauthority

# Export display settings
export DISPLAY XAUTHORITY

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    pkill -f "chromium.*--app=http://localhost:$HTTP_PORT" || true
    pkill -f "python3 -m http.server $HTTP_PORT" || true
    [ -f "$LOCK_FILE" ] && rm -f "$LOCK_FILE" || true
    exit 0
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Wait for X server to be ready
for i in $(seq 1 60); do
    if xset q &>/dev/null; then
        break
    fi
    sleep 1
done

# Ensure we have X server access
xhost +local:infoactive || true

CHROME_FLAGS="
    --kiosk 
    --noerrdialogs 
    --disable-infobars
    --no-sandbox
    --start-maximized
    --window-position=0,0
    --window-size=1920,1080
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
    --disable-restore-session-state
    --disable-session-crashed-bubble
    --disable-infobars
    --check-for-update-interval=31536000
"

# Ensure lock file directory exists
sudo mkdir -p /var/run/kiosk || true
sudo chown infoactive:infoactive /var/run/kiosk || true

# Configure X11 settings
log "Configuring X11 settings..."
xset -dpms || true
xset s off || true
xset s noblank || true

# Kill any existing processes
pkill -f "chromium.*--app=http://localhost:$HTTP_PORT" || true
pkill -f "python3 -m http.server $HTTP_PORT" || true
sleep 2

# Create new lock file
echo $$ > "$LOCK_FILE" || true

# Start HTTP server
log "Starting HTTP server..."
cd "$KIOSK_DIR"
python3 -m http.server $HTTP_PORT &
HTTP_PID=$!

# Wait for HTTP server to start
sleep 2

# Start Chromium
log "Starting Chromium..."
if command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM_CMD=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
    CHROMIUM_CMD=chromium
else
    log "Error: Chromium not found"
    exit 1
fi

$CHROMIUM_CMD $CHROME_FLAGS --app=http://localhost:$HTTP_PORT/index.html &
CHROME_PID=$!

# Wait for browser to start
sleep 5

# Monitor processes
while true; do
    if ! kill -0 $CHROME_PID 2>/dev/null; then
        log "Chromium crashed, restarting..."
        $CHROMIUM_CMD $CHROME_FLAGS --app=http://localhost:$HTTP_PORT/index.html &
        CHROME_PID=$!
        sleep 5
    fi
    
    if ! kill -0 $HTTP_PID 2>/dev/null; then
        log "HTTP server crashed, restarting..."
        cd "$KIOSK_DIR"
        python3 -m http.server $HTTP_PORT &
        HTTP_PID=$!
        sleep 2
    fi
    
    sleep 5
done