#!/bin/bash

# Directory of the player
PLAYER_DIR="/var/www/kiosk"
HTTP_PORT=8000

# Function to start HTTP server
start_http_server() {
    cd "$PLAYER_DIR"
    python3 -m http.server $HTTP_PORT &
    echo $! > /tmp/kiosk-http.pid
}

# Function to start Chromium in kiosk mode
start_chromium() {
    # Wait for HTTP server to start
    sleep 2
    export DISPLAY=:0
    chromium-browser \
        --kiosk \
        --start-fullscreen \
        --disable-restore-session-state \
        --noerrdialogs \
        --disable-session-crashed-bubble \
        --disable-infobars \
        --disable-features=TranslateUI \
        --disable-component-update \
        --autoplay-policy=no-user-gesture-required \
        --check-for-update-interval=31536000 \
        "http://localhost:$HTTP_PORT" &
    echo $! > /tmp/kiosk-chromium.pid
}

# Kill existing processes if they exist
if [ -f /tmp/kiosk-http.pid ]; then
    kill $(cat /tmp/kiosk-http.pid) 2>/dev/null
fi
if [ -f /tmp/kiosk-chromium.pid ]; then
    kill $(cat /tmp/kiosk-chromium.pid) 2>/dev/null
fi

# Make sure the display is on
xset -display :0 s off
xset -display :0 s noblank
xset -display :0 dpms 0 0 0

# Start services
start_http_server
start_chromium

# Monitor and restart if needed
while true; do
    if ! ps -p $(cat /tmp/kiosk-http.pid 2>/dev/null) > /dev/null; then
        echo "HTTP server died, restarting..."
        start_http_server
    fi
    
    if ! ps -p $(cat /tmp/kiosk-chromium.pid 2>/dev/null) > /dev/null; then
        echo "Chromium died, restarting..."
        start_chromium
    fi
    
    sleep 10
done
