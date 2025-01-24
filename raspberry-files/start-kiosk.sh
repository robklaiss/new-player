#!/bin/bash

# Configuration
KIOSK_DIR="/var/www/kiosk"
KIOSK_FILES="$KIOSK_DIR/raspberry-files"
HTTP_PORT=8000
RUNTIME_DIR="/run/user/$(id -u)"
LOCK_FILE="$RUNTIME_DIR/kiosk.pid"
LOG_FILE="/var/log/kiosk.log"
DISPLAY=:0
XAUTHORITY=/home/infoactive/.Xauthority

# Ensure log directory exists and is writable
if [ ! -d "$(dirname "$LOG_FILE")" ]; then
    sudo mkdir -p "$(dirname "$LOG_FILE")"
    sudo chown infoactive:infoactive "$(dirname "$LOG_FILE")"
fi

# Logging function with timestamp and path info
log() {
    local level="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" | tee -a "$LOG_FILE"
}

# Function to check directory/file permissions
check_path() {
    local path="$1"
    local desc="$2"
    
    log "INFO" "Checking $desc: $path"
    if [ -e "$path" ]; then
        log "INFO" "  Exists: Yes"
        log "INFO" "  Type: $(stat -c %F "$path")"
        log "INFO" "  Permissions: $(stat -c %a "$path")"
        log "INFO" "  Owner/Group: $(stat -c %U:%G "$path")"
        if [ -L "$path" ]; then
            log "INFO" "  Symlink points to: $(readlink -f "$path")"
        fi
        return 0
    else
        log "ERROR" "  Path does not exist: $path"
        return 1
    fi
}

# Validate all required paths exist
log "INFO" "=== Starting Kiosk System ==="
log "INFO" "User: $(whoami) ($(id -u):$(id -g))"
log "INFO" "Groups: $(groups)"
log "INFO" "PWD: $(pwd)"

# Check all critical paths
check_path "$KIOSK_DIR" "Kiosk Directory" || exit 1
check_path "$KIOSK_FILES" "Kiosk Files Directory" || exit 1
check_path "$XAUTHORITY" "X Authority File" || exit 1
check_path "$RUNTIME_DIR" "Runtime Directory" || mkdir -p "$RUNTIME_DIR"

# Log system information
log "INFO" "System Information:"
log "INFO" "  User: $(whoami)"
log "INFO" "  Groups: $(groups)"
log "INFO" "  UID: $(id -u)"
log "INFO" "  GID: $(id -g)"
log "INFO" "  PWD: $(pwd)"

# Check all important paths
check_path "/var/run" "Run Directory"
check_path "/run" "Run Directory (alternative)"
check_path "/run/user/$(id -u)" "User Runtime Directory"
check_path "$LOG_FILE" "Log File"
check_path "$(dirname "$LOCK_FILE")" "Lock File Directory"

# Export display settings
export DISPLAY XAUTHORITY
log "INFO" "Display: $DISPLAY"
log "INFO" "XAuthority: $XAUTHORITY"

# Cleanup function
cleanup() {
    log "INFO" "Cleaning up..."
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
sudo mkdir -p "$(dirname "$LOCK_FILE")" || true
sudo chown infoactive:infoactive "$(dirname "$LOCK_FILE")" || true
log "INFO" "Lock file directory created: $(stat -c %a "$(dirname "$LOCK_FILE")")"

# Configure X11 settings
log "INFO" "Configuring X11 settings..."
xset -dpms || true
xset s off || true
xset s noblank || true

# Kill any existing processes
pkill -f "chromium.*--app=http://localhost:$HTTP_PORT" || true
pkill -f "python3 -m http.server $HTTP_PORT" || true
sleep 2

# Create new lock file
echo $$ > "$LOCK_FILE" || true
log "INFO" "Lock file created: $(stat -c %a "$LOCK_FILE")"

# Start HTTP server
log "INFO" "Starting HTTP server..."
cd "$KIOSK_DIR"
python3 -m http.server $HTTP_PORT &
HTTP_PID=$!

# Wait for HTTP server to start
sleep 2

# Start Chromium
log "INFO" "Starting Chromium..."
if command -v chromium-browser >/dev/null 2>&1; then
    CHROMIUM_CMD=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
    CHROMIUM_CMD=chromium
else
    log "ERROR" "Chromium not found"
    exit 1
fi

$CHROMIUM_CMD $CHROME_FLAGS --app=http://localhost:$HTTP_PORT/index.html &
CHROME_PID=$!

# Wait for browser to start
sleep 5

# Monitor processes
while true; do
    if ! kill -0 $CHROME_PID 2>/dev/null; then
        log "ERROR" "Chromium crashed, restarting..."
        $CHROMIUM_CMD $CHROME_FLAGS --app=http://localhost:$HTTP_PORT/index.html &
        CHROME_PID=$!
        sleep 5
    fi
    
    if ! kill -0 $HTTP_PID 2>/dev/null; then
        log "ERROR" "HTTP server crashed, restarting..."
        cd "$KIOSK_DIR"
        python3 -m http.server $HTTP_PORT &
        HTTP_PID=$!
        sleep 2
    fi
    
    sleep 5
done