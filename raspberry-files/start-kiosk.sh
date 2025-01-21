#!/bin/bash

# Directory of the player
PLAYER_DIR="/var/www/kiosk/player"
HTTP_PORT=8000
LOG_FILE="/var/log/kiosk.log"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Debug function
debug() {
    log "DEBUG: $1"
    if [ -n "$2" ]; then
        log "DEBUG: Command output: $2"
    fi
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
    local pid=$!
    echo $pid > /tmp/kiosk-http.pid
    debug "HTTP server PID: $pid"
    
    # Wait for server to be ready
    for i in {1..30}; do
        if curl -s http://localhost:$HTTP_PORT > /dev/null; then
            log "HTTP server is responding"
            return 0
        fi
        log "Waiting for HTTP server... attempt $i"
        sleep 1
    done
    log "Warning: HTTP server not responding after 30 seconds"
    return 1
}

# Function to start browser in kiosk mode
start_browser() {
    log "Starting Chromium in kiosk mode"
    
    # Set display settings
    xset s off
    xset s noblank
    xset -dpms
    
    # Hide cursor
    unclutter -idle 0 &
    
    # Start Chromium in kiosk mode
    chromium-browser \
        --kiosk \
        --noerrdialogs \
        --disable-session-crashed-bubble \
        --disable-infobars \
        --check-for-update-interval=31536000 \
        --disable-features=TranslateUI \
        --autoplay-policy=no-user-gesture-required \
        --allow-file-access-from-files \
        --disable-web-security \
        --user-data-dir=/home/infoactive/.config/chromium \
        "https://vinculo.com.py/new-player/player/?device=device_20250119_06395bce"
}

log "Starting kiosk script"

# Kill existing processes
pkill -f "python3 -m http.server $HTTP_PORT" || true
pkill -f chromium || true
pkill -f unclutter || true

# Clean up old PID files
rm -f /tmp/kiosk-http.pid

# Start HTTP server
start_http_server || exit 1

# Start browser
start_browser || exit 1

# Keep the script running
while true; do
    # Check if HTTP server is running
    if ! curl -s http://localhost:$HTTP_PORT > /dev/null; then
        log "HTTP server not responding, restarting..."
        start_http_server
    fi
    
    # Check if Chromium is running
    if pgrep -f chromium > /dev/null; then
        pid=$(pgrep -f chromium)
        if ! ps -p $pid > /dev/null; then
            log "Chromium not running, restarting..."
            start_browser
        fi
    fi
    
    sleep 30
done
