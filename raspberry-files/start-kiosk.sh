#!/bin/bash

# Set error handling
set -e

# Configuration
KIOSK_DIR="/var/www/kiosk"
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
    if [ "$DEBUG" = "true" ]; then
        log "DEBUG: $1"
    fi
}

# Function to setup system requirements
setup_system() {
    # Set display
    export DISPLAY=:0

    # Disable screen blanking
    xset s off
    xset s noblank
    xset -dpms

    # Hide mouse cursor
    unclutter -idle 0 &

    # Set volume to maximum
    amixer -q sset Master 100%
    amixer -q sset Master unmute

    # Kill any existing processes
    pkill -f chromium || true
    pkill -f python3 || true

    return 0
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
            -c:v h264_omx \
            -profile:v baseline \
            -level 3.0 \
            -pix_fmt yuv420p \
            -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" \
            -c:a aac \
            -b:a 128k \
            -movflags +faststart \
            optimized.mp4
    fi

    # Verify the optimized video
    if ! ffmpeg -v error -i optimized.mp4 -f null - >/dev/null 2>&1; then
        log "ERROR: Failed to create valid optimized video"
        return 1
    fi

    return 0
}

# Function to start HTTP server
start_http_server() {
    cd "$KIOSK_DIR" || exit 1
    
    # Check if port is already in use
    if ! lsof -i:$HTTP_PORT > /dev/null 2>&1; then
        log "Starting HTTP server on port $HTTP_PORT..."
        python3 -m http.server $HTTP_PORT &
        sleep 2
    fi

    # Verify server is running
    if ! curl -s http://localhost:$HTTP_PORT > /dev/null; then
        log "ERROR: Failed to start HTTP server"
        return 1
    fi

    return 0
}

# Function to start browser in kiosk mode
start_browser() {
    # Wait for X server
    until xset q &>/dev/null; do
        sleep 1
    done

    # Start Chromium in kiosk mode
    log "Starting Chromium in kiosk mode..."
    chromium-browser \
        $CHROME_FLAGS \
        --app=http://localhost:$HTTP_PORT/index.html &

    # Wait for browser to start
    sleep 5

    # Move mouse out of the way
    xdotool mousemove 9999 9999

    return 0
}

# Cleanup function
cleanup() {
    pkill -f chromium || true
    pkill -f "python3 -m http.server" || true
    exit 0
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Main script
log "Starting kiosk setup..."

# Setup system requirements
setup_system || {
    log "ERROR: Failed to setup system requirements"
    exit 1
}

# Check and optimize video
check_video || {
    log "ERROR: Failed to check/optimize video"
    exit 1
}

# Start HTTP server
start_http_server || {
    log "ERROR: Failed to start HTTP server"
    exit 1
}

# Start browser
start_browser || {
    log "ERROR: Failed to start browser"
    exit 1
}

# Keep script running
while true; do
    # Check if HTTP server is running
    if ! curl -s http://localhost:$HTTP_PORT > /dev/null; then
        log "HTTP server down, restarting..."
        start_http_server
    fi

    # Check if browser is running
    if ! pgrep -f chromium > /dev/null; then
        log "Browser down, restarting..."
        start_browser
    fi

    sleep 30
done