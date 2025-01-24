#!/bin/bash

# Hide the cursor when inactive
unclutter -idle 0.5 -root &

# Fix for Chromium crash issues
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' ~/.config/chromium/Default/Preferences
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences

# Start Chromium in kiosk mode
/usr/bin/chromium-browser --noerrdialogs --disable-infobars --kiosk http://localhost/index.html \
    --disable-translate \
    --disable-features=TranslateUI \
    --disable-sync \
    --disable-save-password-bubble \
    --disable-session-crashed-bubble \
    --disable-component-update \
    --disable-features=PreloadMediaEngagementData,AutoplayIgnoreWebAudio,MediaEngagementBypassAutoplayPolicies