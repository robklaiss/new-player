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
    
    # Create a simple Python HTTP server with restart endpoint
    python3 -c '
import http.server
import socketserver
import json
import os
import signal

class KioskHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/restart":
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "restarting"}).encode())
            
            # Kill Chromium process
            os.system("pkill -f chromium")
            return

        return super().do_POST(self)

    def log_message(self, format, *args):
        # Suppress logging for cleaner output
        pass

with socketserver.TCPServer(("", 8000), KioskHandler) as httpd:
    print("Server started at port 8000")
    httpd.serve_forever()
' &

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

    # Clear browser cache and temporary files
    rm -rf ~/.cache/chromium
    rm -rf ~/.config/chromium/Default/Cache
    rm -rf /tmp/.org.chromium.*

    # Start Chromium with minimal flags
    chromium-browser \
        --kiosk \
        --disable-gpu-vsync \
        --ignore-gpu-blacklist \
        --enable-gpu-rasterization \
        --enable-zero-copy \
        --disable-features=site-per-process \
        --disable-sync \
        --disable-translate \
        --disable-extensions \
        --no-first-run \
        --no-sandbox \
        --start-maximized \
        --autoplay-policy=no-user-gesture-required \
        --noerrdialogs \
        --disable-infobars \
        --disable-session-crashed-bubble \
        --app=file:///var/www/kiosk/raspberry-files/index.html &

    BROWSER_PID=$!
    
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

# Set up emergency exit key binding (Ctrl+Alt+Q)
xmodmap -e "keycode 24 = q Q q Q"
xmodmap -e "keycode 37 = Control_L Control_L Control_L Control_L"
xmodmap -e "keycode 64 = Alt_L Alt_L Alt_L Alt_L"

# Set up key binding
xbindkeys -f - << EOF
"pkill -f chromium && sudo systemctl stop kiosk.service"
  Control + Alt + q
EOF

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
