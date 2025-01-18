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
    export MOZ_USE_XINPUT2=1
    
    log "Starting Firefox browser"
    debug "Display: $DISPLAY"
    debug "Xauthority: $XAUTHORITY"
    
    # Create Firefox profile directory if it doesn't exist
    FIREFOX_PROFILE_DIR="/var/www/kiosk/.firefox"
    rm -rf "$FIREFOX_PROFILE_DIR"
    mkdir -p "$FIREFOX_PROFILE_DIR"
    
    # Create Firefox preferences
    cat > "$FIREFOX_PROFILE_DIR/user.js" << EOL
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.sessionstore.resume_from_crash", false);
user_pref("browser.sessionstore.enabled", false);
user_pref("browser.sessionstore.resume_session_once", false);
user_pref("browser.cache.disk.enable", false);
user_pref("browser.cache.memory.enable", true);
user_pref("browser.cache.memory.capacity", 16384);
user_pref("browser.rights.3.shown", true);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("browser.tabs.warnOnClose", false);
user_pref("browser.tabs.warnOnCloseOtherTabs", false);
user_pref("browser.tabs.warnOnOpen", false);
user_pref("browser.privatebrowsing.autostart", true);
user_pref("extensions.update.enabled", false);
user_pref("browser.download.manager.retention", 0);
user_pref("browser.download.manager.showWhenStarting", false);
user_pref("browser.helperApps.neverAsk.saveToDisk", "video/mp4");
user_pref("browser.link.open_newwindow", 1);
user_pref("browser.link.open_newwindow.restriction", 0);
user_pref("dom.disable_window_flip", true);
user_pref("dom.disable_window_move_resize", true);
user_pref("dom.event.contextmenu.enabled", false);
EOL

    chown -R infoactive:infoactive "$FIREFOX_PROFILE_DIR"
    
    # Hide cursor
    unclutter -idle 0.5 -root &
    
    # Start Firefox in kiosk mode
    firefox \
        --profile "$FIREFOX_PROFILE_DIR" \
        --kiosk \
        --no-remote \
        --private-window \
        "http://localhost:$HTTP_PORT" &
    
    local pid=$!
    echo $pid > /tmp/kiosk-browser.pid
    debug "Browser PID: $pid"
    
    # Wait to see if browser stays running
    sleep 5
    if ! ps -p $pid > /dev/null; then
        log "Browser failed to start properly"
        return 1
    fi
    
    log "Firefox started with PID $pid"
    return 0
}

log "Starting kiosk script"

# Kill existing processes
pkill -f "python3 -m http.server $HTTP_PORT" || true
pkill -f "firefox.*$HTTP_PORT" || true
killall -9 firefox 2>/dev/null || true
killall -9 firefox-esr 2>/dev/null || true
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
        pkill -f "firefox.*$HTTP_PORT" || true
        killall -9 firefox 2>/dev/null || true
        killall -9 firefox-esr 2>/dev/null || true
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
