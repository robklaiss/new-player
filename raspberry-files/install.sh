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
    apache2 \
    php \
    python3 \
    python3-pip \
    x11-xserver-utils \
    unclutter \
    xdotool

# Create web directory
log "Setting up web directory..."
sudo mkdir -p "$KIOSK_DIR"
sudo chown -R $CURRENT_USER:$CURRENT_USER "$KIOSK_DIR"

# Copy files
log "Copying kiosk files..."
sudo cp -r "$REPO_DIR"/* "$KIOSK_DIR/"
sudo rm "$KIOSK_DIR/install.sh"  # Don't copy install script

# Set up Apache
log "Setting up Apache..."
sudo cp "$KIOSK_DIR/kiosk.conf" /etc/apache2/sites-available/
sudo a2dissite 000-default.conf
sudo a2ensite kiosk.conf
sudo systemctl restart apache2

# Set up services
log "Setting up systemd services..."
sudo cp "$KIOSK_DIR/kiosk.service" /etc/systemd/system/
sudo cp "$KIOSK_DIR/device-monitor.service" /etc/systemd/system/

# Create logs directory
log "Setting up logs directory..."
sudo mkdir -p "$KIOSK_DIR/logs"
sudo chown -R www-data:www-data "$KIOSK_DIR/logs"

# Set permissions
log "Setting up permissions..."
sudo chown -R www-data:www-data "$KIOSK_DIR/api"
sudo chmod -R 755 "$KIOSK_DIR"

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

# Reload and start services
log "Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable kiosk.service
sudo systemctl enable device-monitor.service
sudo systemctl restart device-monitor.service
sudo systemctl restart kiosk.service

log "Installation complete! The kiosk will start automatically on boot."
log "To check the status, run: sudo systemctl status kiosk.service"
log "To view logs, run: journalctl -u kiosk.service -f"
