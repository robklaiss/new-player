#!/bin/bash

# Directory of the player
PLAYER_DIR="/var/www/kiosk"
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
    for i in {1..10}; do
        if curl -s http://localhost:$HTTP_PORT > /dev/null; then
            log "HTTP server is responding"
            return 0
        fi
        sleep 1
    done
    log "Warning: HTTP server not responding after 10 seconds"
}

# Function to start browser in kiosk mode
start_browser() {
    export DISPLAY=:0
    export XAUTHORITY=/home/infoactive/.Xauthority
    export GDK_SCALE=1
    export GDK_DPI_SCALE=1
    
    log "Starting Epiphany browser"
    debug "Display: $DISPLAY"
    debug "Xauthority: $XAUTHORITY"
    
    # Create fresh profile
    rm -rf /var/www/kiosk/.epiphany
    mkdir -p /var/www/kiosk/.epiphany
    chown -R infoactive:infoactive /var/www/kiosk/.epiphany
    
    # Hide cursor
    unclutter -idle 0.5 -root &
    
    # Start Epiphany with debugging
    epiphany-browser \
        --profile=/var/www/kiosk/.epiphany \
        --application-mode \
        --incognito \
        "http://localhost:$HTTP_PORT" \
        --display=:0 2>&1 &
    
    local pid=$!
    echo $pid > /tmp/kiosk-browser.pid
    debug "Browser PID: $pid"
    
    # Wait to see if browser stays running
    sleep 5
    if ! ps -p $pid > /dev/null; then
        log "Browser failed to start properly"
        return 1
    fi
    
    log "Epiphany started with PID $pid"
    return 0
}

log "Starting kiosk script"

# Kill existing processes
pkill -f "python3 -m http.server $HTTP_PORT" || true
pkill -f "epiphany-browser.*$HTTP_PORT" || true
killall -9 epiphany-browser 2>/dev/null || true
killall -9 unclutter 2>/dev/null || true

# Clean up PID files
rm -f /tmp/kiosk-http.pid /tmp/kiosk-browser.pid

# Make sure the display is on
log "Configuring display settings"
xset -display :0 s off || log "Failed to disable screen saver"
xset -display :0 s noblank || log "Failed to disable screen blanking"
xset -display :0 dpms 0 0 0 || log "Failed to disable DPMS"

# Start the services
start_http_server

# Wait for HTTP server to be ready
sleep 5

# Try to start browser up to 3 times
for attempt in {1..3}; do
    log "Browser start attempt $attempt"
    if start_browser; then
        break
    fi
    sleep 5
done

log "Initial services started"

# Monitor and restart if needed
while true; do
    # Check HTTP server
    if [ ! -f /tmp/kiosk-http.pid ] || ! ps -p $(cat /tmp/kiosk-http.pid 2>/dev/null) > /dev/null 2>&1; then
        log "HTTP server died or PID file missing, restarting..."
        pkill -f "python3 -m http.server $HTTP_PORT" || true
        start_http_server
        sleep 5
    fi
    
    # Check browser
    if [ ! -f /tmp/kiosk-browser.pid ] || ! ps -p $(cat /tmp/kiosk-browser.pid 2>/dev/null) > /dev/null 2>&1; then
        log "Browser died or PID file missing, restarting..."
        pkill -f "epiphany-browser.*$HTTP_PORT" || true
        killall -9 epiphany-browser 2>/dev/null || true
        killall -9 unclutter 2>/dev/null || true
        
        # Try to start browser up to 3 times
        for attempt in {1..3}; do
            log "Browser restart attempt $attempt"
            if start_browser; then
                break
            fi
            sleep 5
        done
    fi
    
    sleep 10
done
