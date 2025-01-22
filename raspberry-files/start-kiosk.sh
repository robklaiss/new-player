#!/bin/bash

# Directory of the kiosk files
KIOSK_DIR="/var/www/kiosk/raspberry-files"
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
for i in $(seq 1 60); do
    if xset -q > /dev/null 2>&1; then
        debug "X server is ready"
        break
    fi
    debug "Waiting for X server... ($i/60)"
    sleep 1
done

# Function to start HTTP server
start_http_server() {
    cd "$KIOSK_DIR" || exit 1
    debug "Starting HTTP server in $KIOSK_DIR"
    python3 -m http.server $HTTP_PORT > /dev/null 2>&1 &
    
    # Wait for server to start
    for i in $(seq 1 30); do
        if curl -s http://localhost:$HTTP_PORT > /dev/null; then
            debug "HTTP server is running"
            return 0
        fi
        debug "Waiting for HTTP server... ($i/30)"
        sleep 1
    done
    
    log "ERROR: HTTP server failed to start"
    return 1
}

# Function to start browser in kiosk mode
start_browser() {
    debug "Starting Chromium in kiosk mode"
    
    # Configure Chromium flags
    CHROME_OPTS="--kiosk --disable-infobars --noerrdialogs"
    CHROME_OPTS="$CHROME_OPTS --disable-translate --no-first-run"
    CHROME_OPTS="$CHROME_OPTS --disable-pinch --overscroll-history-navigation=0"
    CHROME_OPTS="$CHROME_OPTS --disable-features=TranslateUI"
    CHROME_OPTS="$CHROME_OPTS --autoplay-policy=no-user-gesture-required"
    
    # Clear cache and temporary files
    rm -rf /home/infoactive/.config/chromium/Default/Cache/*
    rm -rf /home/infoactive/.cache/chromium/*
    
    # Start Chromium
    chromium-browser $CHROME_OPTS "http://localhost:$HTTP_PORT" &
    
    # Wait for browser to start
    sleep 5
    debug "Browser started"
}

log "Starting kiosk script"

# Kill existing processes
pkill -f "python3 -m http.server $HTTP_PORT" || true
pkill chromium || true
pkill chromium-browser || true

# Start HTTP server
start_http_server || exit 1

# Start browser
start_browser

# Keep script running
while true; do
    # Check if HTTP server is running
    if ! curl -s http://localhost:$HTTP_PORT > /dev/null; then
        log "HTTP server died, restarting..."
        start_http_server
    fi
    
    # Check if browser is running
    if ! pgrep chromium > /dev/null; then
        log "Browser died, restarting..."
        start_browser
    fi
    
    sleep 30
done
