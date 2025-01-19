#!/bin/bash

# Directory of the player
PLAYER_DIR="/var/www/kiosk"
HTTP_PORT=8000
LOG_FILE="/var/log/kiosk.log"
FIREFOX_PROFILE="$PLAYER_DIR/.firefox"

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

# Create Firefox profile with required settings
setup_firefox_profile() {
    log "Setting up Firefox profile"
    
    # Create profile directory if it doesn't exist
    mkdir -p "$FIREFOX_PROFILE"
    
    # Create user.js with required settings
    cat > "$FIREFOX_PROFILE/user.js" << EOL
user_pref("browser.cache.disk.enable", true);
user_pref("browser.cache.disk.capacity", 1048576);
user_pref("browser.cache.disk.smart_size.enabled", false);
user_pref("browser.cache.disk.smart_size.first_run", false);
user_pref("browser.sessionstore.resume_from_crash", false);
user_pref("browser.sessionstore.resume_session_once", false);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage", "about:blank");
user_pref("browser.startup.page", 0);
user_pref("dom.serviceWorkers.enabled", true);
user_pref("dom.webnotifications.enabled", true);
user_pref("dom.push.enabled", true);
user_pref("dom.serviceWorkers.testing.enabled", true);
user_pref("privacy.trackingprotection.enabled", false);
user_pref("network.cookie.cookieBehavior", 0);
user_pref("security.mixed_content.block_active_content", false);
user_pref("security.mixed_content.block_display_content", false);
EOL
    
    # Set permissions
    chown -R infoactive:infoactive "$FIREFOX_PROFILE"
    chmod 755 "$FIREFOX_PROFILE"
    chmod 644 "$FIREFOX_PROFILE/user.js"
    
    log "Firefox profile setup complete"
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
    log "Starting Firefox in kiosk mode"
    
    # Set display settings
    xset s off
    xset s noblank
    xset -dpms
    
    # Hide cursor
    unclutter -idle 0 &
    
    # Setup Firefox profile
    setup_firefox_profile
    
    # Wait a bit for HTTP server
    sleep 5
    
    # Start Firefox in kiosk mode
    firefox --profile "$FIREFOX_PROFILE" \
           --kiosk \
           --no-remote \
           --private-window \
           --enable-features=ServiceWorkerServicification \
           "http://localhost:$HTTP_PORT" &
    
    local pid=$!
    echo $pid > /tmp/kiosk-browser.pid
    debug "Firefox PID: $pid"
    
    # Wait to ensure Firefox starts
    sleep 5
    
    # Check if Firefox is actually running
    if ! ps -p $pid > /dev/null; then
        log "Error: Firefox failed to start"
        return 1
    fi
    
    log "Firefox started successfully"
    return 0
}

log "Starting kiosk script"

# Kill existing processes
pkill -f "python3 -m http.server $HTTP_PORT" || true
pkill -f firefox || true
pkill -f unclutter || true

# Clean up old PIDs
rm -f /tmp/kiosk-http.pid /tmp/kiosk-browser.pid

# Start HTTP server
start_http_server || exit 1

# Start browser
start_browser || exit 1

# Keep script running
while true; do
    # Check if HTTP server is running
    if ! curl -s http://localhost:$HTTP_PORT > /dev/null; then
        log "HTTP server not responding, restarting..."
        start_http_server
    fi
    
    # Check if Firefox is running
    if [ -f /tmp/kiosk-browser.pid ]; then
        pid=$(cat /tmp/kiosk-browser.pid)
        if ! ps -p $pid > /dev/null; then
            log "Firefox not running, restarting..."
            start_browser
        fi
    fi
    
    sleep 30
done
