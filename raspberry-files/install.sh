#!/bin/bash

# Enable error handling
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Log function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
fi

# Install required packages
log "Installing required packages..."
apt update
apt install -y git chromium-browser unclutter xserver-xorg x11-xserver-utils python3-flask python3-requests lightdm

# Enable and start lightdm
log "Enabling display manager..."
systemctl enable lightdm
systemctl start lightdm

# Create and set up directories
log "Setting up directories..."
mkdir -p /var/www
cd /var/www

# Remove existing kiosk directory if it exists
if [ -d "kiosk" ]; then
    log "Removing existing kiosk directory..."
    rm -rf kiosk
fi

# Clone the repository
log "Cloning repository..."
git config --global --add safe.directory /var/www/kiosk
git clone --depth 1 https://github.com/robklaiss/new-player.git kiosk || error "Failed to clone repository"

# Set up service files
log "Setting up service files..."
cp /var/www/kiosk/raspberry-files/kiosk.service /etc/systemd/system/
chmod +x /var/www/kiosk/raspberry-files/start-kiosk.sh
cp /var/www/kiosk/raspberry-files/start-kiosk.sh /var/www/kiosk/

# Set correct permissions
log "Setting permissions..."
chown -R pi:pi /var/www/kiosk
usermod -a -G video pi

# Create X11 socket directory with correct permissions
log "Setting up X11 socket directory..."
mkdir -p /tmp/.X11-unix
chmod 1777 /tmp/.X11-unix

# Reload systemd and enable services
log "Enabling services..."
systemctl daemon-reload
systemctl enable kiosk.service
systemctl restart kiosk.service

log "Installation complete!"
log "You can check the status with: systemctl status kiosk.service"
log "View logs with: tail -f /var/log/kiosk.log"
