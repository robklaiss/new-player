#!/bin/bash

# Exit on error
set -e

# Configuration
KIOSK_DIR="/var/www/kiosk"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CURRENT_USER=$(whoami)
HOME_DIR=$(eval echo ~$CURRENT_USER)

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Install system dependencies
log "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y \
    chromium-browser \
    ffmpeg \
    fontconfig \
    python3 \
    x11-xserver-utils \
    unclutter \
    xdotool \
    fonts-liberation \
    libegl1 \
    libgl1-mesa-dri \
    libgles2

# Create kiosk directory
log "Setting up kiosk directory..."
sudo mkdir -p "$KIOSK_DIR"
sudo chown -R $CURRENT_USER:$CURRENT_USER "$KIOSK_DIR"

# Copy files
log "Copying kiosk files..."
cp -r "$REPO_DIR"/* "$KIOSK_DIR/"
chmod +x "$KIOSK_DIR/start-kiosk.sh"

# Setup systemd service
log "Setting up systemd service..."
sudo tee /etc/systemd/system/kiosk.service > /dev/null << EOL
[Unit]
Description=Kiosk Video Player
After=network.target

[Service]
Environment=DISPLAY=:0
Environment=XAUTHORITY=$HOME_DIR/.Xauthority
Type=simple
User=$CURRENT_USER
ExecStart=/bin/bash $KIOSK_DIR/start-kiosk.sh
Restart=on-failure
RestartSec=5
WorkingDirectory=$KIOSK_DIR

[Install]
WantedBy=multi-user.target
EOL

# Setup X11 configuration
log "Setting up X11 configuration..."
sudo mkdir -p /etc/X11/xorg.conf.d
sudo tee /etc/X11/xorg.conf.d/10-monitor.conf > /dev/null << EOL
Section "Monitor"
    Identifier "HDMI-1"
    Option "DPMS" "false"
EndSection

Section "ServerFlags"
    Option "BlankTime" "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime" "0"
EndSection
EOL

# Setup video device permissions
log "Setting up video permissions..."
sudo usermod -a -G video $CURRENT_USER
if [ -e "/dev/video10" ]; then
    sudo chmod 666 /dev/video10
fi

# Create Xauthority if it doesn't exist
touch "$HOME_DIR/.Xauthority"
chown $CURRENT_USER:$CURRENT_USER "$HOME_DIR/.Xauthority"

# Set up auto-login
log "Setting up auto-login..."
sudo mkdir -p /etc/lightdm/lightdm.conf.d
sudo tee /etc/lightdm/lightdm.conf.d/autologin.conf > /dev/null << EOL
[Seat:*]
autologin-user=$CURRENT_USER
autologin-user-timeout=0
EOL

# Enable and start service
log "Enabling and starting kiosk service..."
sudo systemctl daemon-reload
sudo systemctl enable kiosk.service
sudo systemctl restart kiosk.service

log "Installation complete! The kiosk will start automatically on boot."
log "To check the status, run: sudo systemctl status kiosk.service"
log "To view logs, run: journalctl -u kiosk.service -f"
