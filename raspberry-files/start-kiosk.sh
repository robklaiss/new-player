#!/bin/bash

# Enable debugging
set -x

# Configuration
KIOSK_DIR="/var/www/kiosk"
KIOSK_FILES="$KIOSK_DIR/raspberry-files"
HTTP_PORT=8000
RUNTIME_DIR="/run/user/$(id -u)"
LOCK_FILE="$RUNTIME_DIR/kiosk.pid"
LOG_FILE="/var/log/kiosk.log"
DISPLAY=:0
XAUTHORITY=/home/infoactive/.Xauthority
XDG_RUNTIME_DIR=/run/user/$(id -u)

# Export display settings
export DISPLAY XAUTHORITY XDG_RUNTIME_DIR

# Ensure we can write to the log
touch "$LOG_FILE" 2>/dev/null || sudo touch "$LOG_FILE"
sudo chown infoactive:infoactive "$LOG_FILE" 2>/dev/null || true

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Error handler
error_handler() {
    local line_no=$1
    local error_code=$2
    log "ERROR: Command failed at line $line_no with exit code $error_code"
    # Don't exit on error, just log it
}

# Set error trap
trap 'error_handler ${LINENO} $?' ERR

# Cleanup function
cleanup() {
    log "INFO: Cleaning up processes..."
    pkill -f "chromium.*--kiosk.*localhost:$HTTP_PORT" || true
    pkill -f "python3 -m http.server $HTTP_PORT" || true
    [ -f "$LOCK_FILE" ] && rm -f "$LOCK_FILE"
    exit 0
}

# Set up cleanup trap
trap cleanup SIGTERM SIGINT SIGHUP EXIT

# Log initial state
log "INFO: Starting kiosk script..."
log "INFO: User: $(whoami)"
log "INFO: Groups: $(groups)"
log "INFO: Display: $DISPLAY"
log "INFO: XAuthority: $XAUTHORITY"
log "INFO: Working Directory: $(pwd)"

# Wait for Wayland and X11 socket
while [ ! -e "$XDG_RUNTIME_DIR/wayland-0" ] || [ ! -e "/tmp/.X11-unix/X0" ]; do
    log "INFO: Waiting for display server..."
    sleep 1
done

# Additional Wayland-specific environment
export MOZ_ENABLE_WAYLAND=1

# Ensure X server access
for i in $(seq 1 30); do
    if xhost +local:infoactive; then
        log "INFO: X server access granted"
        break
    fi
    if [ $i -eq 30 ]; then
        log "WARN: Could not set xhost access, continuing anyway"
    fi
    sleep 1
done

# Configure X11 settings (retry if failed)
for cmd in "xset -dpms" "xset s off" "xset s noblank"; do
    for i in $(seq 1 3); do
        if $cmd; then
            break
        fi
        sleep 1
    done
done

# Create runtime directory if needed
mkdir -p "$RUNTIME_DIR" 2>/dev/null || sudo mkdir -p "$RUNTIME_DIR"
sudo chown -R infoactive:infoactive "$RUNTIME_DIR" 2>/dev/null || true

# Create lock file
echo $$ > "$LOCK_FILE"

# Start HTTP server
cd "$KIOSK_DIR" || {
    log "ERROR: Failed to change to kiosk directory"
    exit 1
}

python3 -m http.server $HTTP_PORT &
HTTP_PID=$!

# Wait for HTTP server
for i in $(seq 1 30); do
    if curl -s http://localhost:$HTTP_PORT >/dev/null; then
        log "INFO: HTTP server is running"
        break
    fi
    if [ $i -eq 30 ]; then
        log "ERROR: HTTP server failed to start"
        exit 1
    fi
    sleep 1
done

# Chromium flags for software rendering
CHROME_FLAGS="
    --kiosk
    --disable-gpu
    --disable-gpu-compositing
    --disable-gpu-rasterization
    --disable-software-rasterizer
    --disable-dev-shm-usage
    --no-sandbox
    --ignore-gpu-blocklist
    --disable-accelerated-2d-canvas
    --disable-accelerated-video-decode
    --disable-gpu-memory-buffer-compositor-resources
    --disable-gpu-memory-buffer-video-frames
    --disable-gpu-vsync
    --use-gl=swiftshader
"

# Additional Wayland-specific flags
CHROMIUM_FLAGS="$CHROME_FLAGS --enable-features=UseOzonePlatform --ozone-platform=wayland"

# Start Chromium (retry if failed)
for i in $(seq 1 3); do
    log "INFO: Starting Chromium (attempt $i)..."
    chromium-browser $CHROMIUM_FLAGS "http://localhost:$HTTP_PORT" &
    CHROME_PID=$!
    
    sleep 5
    
    if kill -0 $CHROME_PID 2>/dev/null; then
        log "INFO: Browser started successfully"
        break
    else
        log "ERROR: Browser failed to start"
        if [ $i -eq 3 ]; then
            log "ERROR: All browser start attempts failed"
            cleanup
            exit 1
        fi
    fi
done

log "INFO: Kiosk startup complete"

# Monitor browser and restart if needed
while true; do
    if ! kill -0 $CHROME_PID 2>/dev/null; then
        log "ERROR: Browser died, restarting..."
        chromium-browser $CHROMIUM_FLAGS "http://localhost:$HTTP_PORT" &
        CHROME_PID=$!
        sleep 5
    fi
    
    if ! kill -0 $HTTP_PID 2>/dev/null; then
        log "ERROR: HTTP server died, restarting..."
        cd "$KIOSK_DIR" || continue
        python3 -m http.server $HTTP_PORT &
        HTTP_PID=$!
        sleep 2
    fi
    
    sleep 1
done