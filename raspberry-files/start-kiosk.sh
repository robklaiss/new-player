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
    # Set process limits
    ulimit -n 1024
    ulimit -u 512

    # Wait for HTTP server to be ready
    local max_retries=30
    local retry_count=0
    while ! curl -s http://localhost:$HTTP_PORT >/dev/null; do
        retry_count=$((retry_count + 1))
        if [ $retry_count -ge $max_retries ]; then
            log "ERROR: HTTP server not responding after $max_retries attempts"
            return 1
        fi
        log "Waiting for HTTP server (attempt $retry_count/$max_retries)..."
        sleep 1
    done

    log "Starting Chromium in kiosk mode..."
    
    # Start Chromium with optimized flags
    chromium-browser \
        --kiosk \
        --noerrdialogs \
        --disable-infobars \
        --disable-features=TranslateUI \
        --disable-features=PreloadMediaEngagementData \
        --disable-session-crashed-bubble \
        --disable-pinch \
        --overscroll-history-navigation=0 \
        --check-for-update-interval=31536000 \
        --autoplay-policy=no-user-gesture-required \
        --disable-background-timer-throttling \
        --disable-background-networking \
        --disable-breakpad \
        --disable-client-side-phishing-detection \
        --disable-default-apps \
        --disable-dev-shm-usage \
        --disable-extensions \
        --disable-hang-monitor \
        --disable-prompt-on-repost \
        --disable-sync \
        --disable-translate \
        --metrics-recording-only \
        --no-first-run \
        --password-store=basic \
        --start-maximized \
        --window-position=0,0 \
        --window-size=1920,1080 \
        --use-gl=egl \
        --no-sandbox \
        --test-type \
        --ignore-certificate-errors \
        "http://localhost:$HTTP_PORT" &

    BROWSER_PID=$!
    debug "Browser started with PID: $BROWSER_PID"
    
    # Wait for browser to start
    sleep 5
    
    # Check if browser is actually running
    if ! kill -0 $BROWSER_PID 2>/dev/null; then
        log "ERROR: Browser failed to start"
        return 1
    fi
    
    # Monitor browser process
    while kill -0 $BROWSER_PID 2>/dev/null; do
        sleep 5
        # Check memory usage
        MEM_USAGE=$(ps -o rss= -p $BROWSER_PID)
        if [ -n "$MEM_USAGE" ] && [ $MEM_USAGE -gt 500000 ]; then
            log "WARNING: High memory usage detected ($MEM_USAGE KB). Restarting browser..."
            kill $BROWSER_PID
            sleep 5
            start_browser
            return
        fi
    done
}

log "Starting kiosk script"

# Kill existing processes
log "Cleaning up existing processes..."
pkill -f "python3 -m http.server $HTTP_PORT" || true
pkill -f "chromium" || true
sleep 2

# Make sure all Chromium processes are really gone
killall -9 chromium chromium-browser 2>/dev/null || true
sleep 1

# Set up window manager to prevent screen blanking
xset s off
xset s noblank
xset -dpms

# Remove any existing Chromium preferences that might interfere
rm -rf ~/.config/chromium/Default/Preferences
rm -rf ~/.config/chromium/Singleton*

# Start HTTP server
start_http_server || exit 1

# Start browser
start_browser

# Add trap for cleanup
trap 'cleanup' EXIT SIGTERM SIGINT
cleanup() {
    log "Cleaning up..."
    pkill -f "chromium" || true
    pkill -f "python3 -m http.server $HTTP_PORT" || true
    exit 0
}

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
