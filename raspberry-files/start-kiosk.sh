#!/bin/bash

# Enable error handling
set -e

# Directory of the player
PLAYER_DIR="/var/www/kiosk"
HTTP_PORT=8000
LOG_FILE="/var/log/kiosk.log"
CURRENT_USER=$(whoami)

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Wait for X server
for i in {1..30}; do
    if xset -q > /dev/null 2>&1; then
        log "X server is running"
        break
    fi
    log "Waiting for X server... attempt $i"
    sleep 1
done

# Function to start HTTP server
start_http_server() {
    cd "$PLAYER_DIR"
    log "Starting HTTP server on port $HTTP_PORT"
    python3 -m http.server $HTTP_PORT &
    echo $! > /tmp/kiosk-http.pid
    log "HTTP server started with PID $(cat /tmp/kiosk-http.pid)"
}

# Function to start Chromium in kiosk mode
start_chromium() {
    # Wait for HTTP server to start
    sleep 5
    export DISPLAY=:0
    export XAUTHORITY=/home/$CURRENT_USER/.Xauthority
    
    log "Starting Chromium browser"
    
    # Hide cursor
    unclutter -idle 0.5 -root &
    
    # Start Chromium in full kiosk mode
    chromium-browser \
        --noerrdialogs \
        --disable-infobars \
        --disable-translate \
        --disable-features=TranslateUI \
        --disable-session-crashed-bubble \
        --disable-component-update \
        --disable-pinch \
        --overscroll-history-navigation=0 \
        --disable-features=TouchpadOverscrollHistoryNavigation \
        --check-for-update-interval=31536000 \
        --kiosk \
        --app=http://localhost:$HTTP_PORT &
    
    echo $! > /tmp/kiosk-chromium.pid
    log "Chromium started with PID $(cat /tmp/kiosk-chromium.pid)"
}

# Create log file if it doesn't exist
touch "$LOG_FILE"
chown $CURRENT_USER:$CURRENT_USER "$LOG_FILE"

log "Starting kiosk script"

# Kill existing processes if they exist
if [ -f /tmp/kiosk-http.pid ]; then
    log "Killing existing HTTP server"
    kill $(cat /tmp/kiosk-http.pid) 2>/dev/null || true
fi

if [ -f /tmp/kiosk-chromium.pid ]; then
    log "Killing existing Chromium instance"
    kill $(cat /tmp/kiosk-chromium.pid) 2>/dev/null || true
fi

# Make sure the display is on
log "Configuring display settings"
xset -display :0 s off || log "Failed to disable screen saver"
xset -display :0 s noblank || log "Failed to disable screen blanking"
xset -display :0 dpms 0 0 0 || log "Failed to disable DPMS"

# Make sure we're in kiosk directory
cd "$PLAYER_DIR" || {
    log "Failed to change to $PLAYER_DIR directory"
    exit 1
}

# Start the services
start_http_server
start_chromium

log "Initial services started"

# Monitor and restart if needed
while true; do
    if ! ps -p $(cat /tmp/kiosk-http.pid 2>/dev/null) > /dev/null; then
        log "HTTP server died, restarting..."
        start_http_server
    fi
    
    if ! ps -p $(cat /tmp/kiosk-chromium.pid 2>/dev/null) > /dev/null; then
        log "Chromium died, restarting..."
        start_chromium
    fi
    
    sleep 10
done
