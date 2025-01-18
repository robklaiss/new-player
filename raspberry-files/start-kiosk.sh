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
user_pref("browser.cache.memory.enable", true);
user_pref("browser.sessionstore.resume_from_crash", false);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.tabs.warnOnClose", false);
user_pref("browser.startup.homepage", "http://localhost:$HTTP_PORT");
user_pref("dom.serviceWorkers.enabled", true);
user_pref("dom.webworkers.enabled", true);
user_pref("dom.serviceWorkers.testing.enabled", true);
user_pref("security.fileuri.strict_origin_policy", false);
user_pref("privacy.file_unique_origin", false);
user_pref("browser.sessionstore.enabled", false);
user_pref("toolkit.startup.max_resumed_crashes", -1);
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
    log "Starting Firefox in kiosk mode"
    
    # Set display settings
    xset s off
    xset s noblank
    xset -dpms
    
    # Hide cursor
    unclutter -idle 0 &
    
    # Setup Firefox profile
    setup_firefox_profile
    
    # Start Firefox in kiosk mode
    firefox --profile "$FIREFOX_PROFILE" \
           --kiosk \
           --no-remote \
           --private-window \
           "http://localhost:$HTTP_PORT" &
    
    local pid=$!
    echo $pid > /tmp/kiosk-browser.pid
    debug "Firefox PID: $pid"
}

log "Starting kiosk script"

# Kill existing processes
pkill -f "python3 -m http.server $HTTP_PORT" || true
pkill -f "firefox.*--kiosk" || true
pkill -f "unclutter" || true

# Start HTTP server
start_http_server

# Start browser
start_browser

# Keep script running
while true; do
    # Check if browser is still running
    if ! pgrep -f "firefox.*--kiosk" > /dev/null; then
        log "Browser crashed or closed, restarting..."
        start_browser
    fi
    
    # Check if HTTP server is still running
    if ! pgrep -f "python3 -m http.server $HTTP_PORT" > /dev/null; then
        log "HTTP server crashed, restarting..."
        start_http_server
    fi
    
    sleep 10
done
