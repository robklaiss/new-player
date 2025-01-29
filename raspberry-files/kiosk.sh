#!/bin/bash

# Kill any existing Chromium processes
pkill chromium

# Hide the cursor when inactive
unclutter -idle 0.5 -root &

# Clean up crashed session files
rm -rf ~/.config/chromium/Singleton*
rm -rf ~/.config/chromium/SingletonSocket
rm -rf ~/.config/chromium/SingletonLock

# Fix for Chromium crash issues
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' ~/.config/chromium/Default/Preferences
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences

# Clear cache and temporary files
rm -rf ~/.cache/chromium/Default/Cache/*
rm -rf ~/.cache/chromium/Default/Media\ Cache/*

# Set process priority
renice -n 10 $$

# Start Chromium in kiosk mode with optimized flags
/usr/bin/chromium-browser \
    --noerrdialogs \
    --disable-infobars \
    --kiosk file:///var/www/kiosk/index.html \
    --disable-translate \
    --disable-features=TranslateUI \
    --disable-sync \
    --disable-save-password-bubble \
    --disable-session-crashed-bubble \
    --disable-component-update \
    --disable-features=PreloadMediaEngagementData,AutoplayIgnoreWebAudio,MediaEngagementBypassAutoplayPolicies \
    --enable-gpu-rasterization \
    --enable-zero-copy \
    --disable-gpu-vsync \
    --disable-software-rasterizer \
    --js-flags="--max-old-space-size=128" \
    --single-process \
    --disable-dev-shm-usage \
    --disable-background-networking \
    --memory-pressure-off \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-renderer-backgrounding \
    --disable-background-networking \
    --disable-client-side-phishing-detection \
    --disable-default-apps \
    --disable-extensions \
    --disable-popup-blocking \
    --disable-prompt-on-repost \
    --no-first-run \
    --no-default-browser-check \
    --no-experiments \
    --force-gpu-rasterization \
    --ignore-gpu-blocklist \
    --metrics-recording-only \
    --password-store=basic \
    --use-gl=egl \
    --enable-accelerated-video-decode \
    --autoplay-policy=no-user-gesture-required &

# Wait for Chromium to start
sleep 5

# Set window properties for kiosk mode
xdotool search --sync --onlyvisible --class "Chromium" windowactivate

# Monitor memory usage and restart if necessary
while true; do
    sleep 300  # Check every 5 minutes
    mem=$(ps -o rss= -p $(pgrep chromium) | awk '{sum += $1} END {print sum}')
    if [ $mem -gt 300000 ]; then  # 300MB
        echo "Memory usage exceeded limit. Restarting Chromium..."
        pkill chromium
        sleep 5
        exec "$0"  # Restart the script
    fi
done