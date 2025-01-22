#!/bin/bash

# Set error handling
set -e

# Configuration
KIOSK_DIR="/var/www/kiosk/raspberry-files"
HTTP_PORT=8000
CHROME_FLAGS="
    --kiosk 
    --noerrdialogs 
    --disable-infobars
    --autoplay-policy=no-user-gesture-required
    --check-for-update-interval=31536000
    --disable-gpu-vsync
    --ignore-gpu-blocklist
    --disable-gpu-driver-bug-workarounds
    --enable-gpu-rasterization
    --enable-zero-copy
    --disable-features=UseOzonePlatform
    --use-gl=egl
    --force-device-scale-factor=1
"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Debug function
debug() {
    if [ "${DEBUG:-0}" = "1" ]; then
        log "DEBUG: $1"
    fi
}

# Function to setup system requirements
setup_system() {
    # Create kiosk directory if it doesn't exist
    if [ ! -d "$KIOSK_DIR" ]; then
        sudo mkdir -p "$KIOSK_DIR"
    fi
    
    # Set proper permissions
    sudo chown -R $USER:$USER "$KIOSK_DIR"
    
    # Install required packages if missing
    for pkg in chromium-browser ffmpeg fontconfig python3; do
        if ! dpkg -l | grep -q "^ii  $pkg "; then
            log "Installing $pkg..."
            sudo apt-get update
            sudo apt-get install -y $pkg
        fi
    done
    
    # Setup fonts
    if [ ! -f /etc/fonts/fonts.conf ]; then
        log "Setting up font configuration..."
        sudo mkdir -p /etc/fonts
        sudo tee /etc/fonts/fonts.conf > /dev/null << EOL
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
    <dir>/usr/share/fonts</dir>
    <dir>/usr/local/share/fonts</dir>
    <dir prefix="xdg">fonts</dir>
    <cachedir>/var/cache/fontconfig</cachedir>
    <cachedir prefix="xdg">fontconfig</cachedir>
</fontconfig>
EOL
        sudo fc-cache -f -v
    fi
    
    # Setup video device permissions
    if [ -e "/dev/video10" ]; then
        sudo chmod 666 /dev/video10
    fi
    
    # Setup X11 environment
    export DISPLAY=:0
    xset -dpms     # Disable DPMS (Energy Star) features
    xset s off     # Disable screen saver
    xset s noblank # Don't blank the video device
    
    # Disable screen blanking in X
    if command -v xset >/dev/null 2>&1; then
        xset s off
        xset s noblank
        xset -dpms
    fi
}

# Function to check and optimize video
check_video() {
    cd "$KIOSK_DIR" || exit 1
    
    # Check if source video exists
    if [ ! -f "sample.mp4" ]; then
        log "ERROR: source video sample.mp4 not found"
        return 1
    fi

    # Check if optimized video exists and is valid
    if [ ! -f "optimized.mp4" ] || ! ffmpeg -v error -i optimized.mp4 -f null - >/dev/null 2>&1; then
        log "Re-encoding video for Raspberry Pi..."
        
        # Remove old file if exists
        rm -f optimized.mp4
        
        # Encode for maximum compatibility
        ffmpeg -i sample.mp4 \
            -c:v h264 \
            -profile:v baseline \
            -level 3.0 \
            -pix_fmt yuv420p \
            -vf "scale=1280:720" \
            -b:v 2M \
            -maxrate 2M \
            -bufsize 2M \
            -movflags +faststart \
            -y \
            optimized.mp4
            
        if [ $? -ne 0 ]; then
            log "ERROR: Video optimization failed"
            return 1
        fi
        
        log "Video optimization complete"
    else
        log "Optimized video already exists and is valid"
    fi
}

# Function to start HTTP server
start_http_server() {
    cd "$KIOSK_DIR" || exit 1
    debug "Starting HTTP server in $KIOSK_DIR"
    
    # Create a simple Python HTTP server with restart endpoint and CORS support
    python3 -c '
import http.server
import socketserver
import json
import os
import signal

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-Id")
        super().end_headers()
        
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()
        
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

with socketserver.TCPServer(("", 8000), CORSHTTPRequestHandler) as httpd:
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

# Main script
log "Starting kiosk setup..."

# Setup system requirements
setup_system || exit 1

# Check and optimize video
check_video || exit 1

# Start HTTP server
start_http_server || exit 1

# Clear Chromium cache
rm -rf ~/.cache/chromium/Default/Cache/*
rm -rf ~/.config/chromium/Default/Cache/*

# Start Chromium in kiosk mode
log "Starting Chromium..."
chromium-browser \
    $CHROME_FLAGS \
    --app=http://localhost:$HTTP_PORT/index.html \
    --user-data-dir=/tmp/chromium \
    --no-first-run \
    --start-maximized \
    --window-position=0,0 \
    --window-size=1920,1080 \
    --disable-features=TranslateUI \
    --disable-session-crashed-bubble

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
