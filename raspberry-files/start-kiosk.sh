#!/bin/bash

# Configuration
KIOSK_DIR="/var/www/kiosk"
HTTP_PORT=8000
LOCK_FILE="/var/run/kiosk/kiosk.pid"  # We'll keep this for now until we verify the correct path
DISPLAY=:0
XAUTHORITY=/home/infoactive/.Xauthority
LOG_FILE="/var/log/kiosk.log"

# Logging function with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check directory/file permissions
check_path() {
    local path="$1"
    local desc="$2"
    
    log "Checking $desc: $path"
    if [ -e "$path" ]; then
        log "  Exists: Yes"
        log "  Type: $(stat -c %F "$path")"
        log "  Permissions: $(stat -c %a "$path")"
        log "  Owner/Group: $(stat -c %U:%G "$path")"
        if [ -L "$path" ]; then
            log "  Symlink points to: $(readlink -f "$path")"
        fi
    else
        log "  Does not exist"
    fi
}

# Log system information
log "=== Starting Kiosk System ==="
log "User: $(whoami)"
log "Groups: $(groups)"
log "UID: $(id -u)"
log "GID: $(id -g)"
log "PWD: $(pwd)"

# Check all important paths
check_path "$KIOSK_DIR" "Kiosk Directory"
check_path "/var/run" "Run Directory"
check_path "/run" "Run Directory (alternative)"
check_path "/run/user/$(id -u)" "User Runtime Directory"
check_path "$XAUTHORITY" "X Authority File"
check_path "$LOG_FILE" "Log File"
check_path "$(dirname "$LOCK_FILE")" "Lock File Directory"

# Export display settings
export DISPLAY XAUTHORITY
log "Display: $DISPLAY"
log "XAuthority: $XAUTHORITY"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Cleanup function
cleanup() {
    log "Cleaning up..."
    pkill -f "chromium.*--app=http://localhost:$HTTP_PORT" || true
    pkill -f "python3 -m http.server $HTTP_PORT" || true
    [ -f "$LOCK_FILE" ] && rm -f "$LOCK_FILE" || true
    exit 0
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Wait for X server to be ready
for i in $(seq 1 60); do
    if xset q &>/dev/null; then
        break
    fi
    sleep 1
done

# Ensure we have X server access
xhost +local:infoactive || true

CHROME_FLAGS="
    --kiosk 
    --noerrdialogs 
    --disable-infobars
    --no-sandbox
    --start-maximized
    --window-position=0,0
    --window-size=1920,1080
    --autoplay-policy=no-user-gesture-required
    --disable-gpu-vsync
    --ignore-gpu-blocklist
    --disable-gpu-driver-bug-workarounds
    --enable-gpu-rasterization
    --enable-zero-copy
    --enable-accelerated-video-decode
    --enable-accelerated-mjpeg-decode
    --enable-features=VaapiVideoDecoder
    --disable-features=UseOzonePlatform
    --use-gl=egl
    --enable-hardware-overlays
    --force-device-scale-factor=1
    --disable-background-timer-throttling
    --disable-backgrounding-occluded-windows
    --disk-cache-size=1
    --media-cache-size=1
    --process-per-site
    --disable-restore-session-state
    --disable-session-crashed-bubble
    --disable-infobars
    --check-for-update-interval=31536000
"

# Ensure lock file directory exists
sudo mkdir -p /var/run/kiosk || true
sudo chown infoactive:infoactive /var/run/kiosk || true
log "Lock file directory created: $(stat -c %a /var/run/kiosk)"

# Configure X11 settings
log "Configuring X11 settings..."
xset -dpms || true
xset s off || true
xset s noblank || true

# Kill any existing processes
pkill -f "chromium.*--app=http://localhost:$HTTP_PORT" || true
pkill -f "python3 -m http.server $HTTP_PORT" || true
sleep 2

# Create new lock file
echo $$ > "$LOCK_FILE" || true
log "Lock file created: $(stat -c %a "$LOCK_FILE")"

# Start HTTP server
log "Starting HTTP server..."
cd "$KIOSK_DIR"
python3 -m http.server $HTTP_PORT &
HTTP_PID=$!

# Wait for HTTP server to start
sleep 2

# Start Chromium
log "Starting Chromium..."
if command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM_CMD=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
    CHROMIUM_CMD=chromium
else
    log "Error: Chromium not found"
    exit 1
fi

$CHROMIUM_CMD $CHROME_FLAGS --app=http://localhost:$HTTP_PORT/index.html &
CHROME_PID=$!

# Wait for browser to start
sleep 5

# Monitor processes
while true; do
    if ! kill -0 $CHROME_PID 2>/dev/null; then
        log "Chromium crashed, restarting..."
        $CHROMIUM_CMD $CHROME_FLAGS --app=http://localhost:$HTTP_PORT/index.html &
        CHROME_PID=$!
        sleep 5
    fi
    
    if ! kill -0 $HTTP_PID 2>/dev/null; then
        log "HTTP server crashed, restarting..."
        cd "$KIOSK_DIR"
        python3 -m http.server $HTTP_PORT &
        HTTP_PID=$!
        sleep 2
    fi
    
    sleep 5
done