#!/bin/bash

# Enable error handling
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Log functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
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
apt install -y git chromium-browser unclutter xserver-xorg x11-xserver-utils python3-flask python3-requests lightdm openssh-client

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

# Try cloning with SSH first, fall back to HTTPS
log "Cloning repository..."
git config --global --add safe.directory /var/www/kiosk

if [ -f "/home/pi/.ssh/id_ed25519" ]; then
    log "Found SSH key, attempting SSH clone..."
    sudo -u pi git clone --depth 1 git@github.com:robklaiss/new-player.git kiosk || {
        warn "SSH clone failed, trying HTTPS..."
        git clone --depth 1 https://github.com/robklaiss/new-player.git kiosk || {
            error "Failed to clone repository. Please ensure you have access and try again."
        }
    }
else
    warn "No SSH key found at /home/pi/.ssh/id_ed25519"
    warn "To set up SSH access:"
    warn "1. Run: sudo -u pi ssh-keygen -t ed25519 -C \"raspberry-kiosk\""
    warn "2. Display the key: sudo -u pi cat /home/pi/.ssh/id_ed25519.pub"
    warn "3. Add the key to GitHub under repository Deploy Keys"
    warn ""
    warn "Trying HTTPS clone..."
    git clone --depth 1 https://github.com/robklaiss/new-player.git kiosk || {
        error "Failed to clone repository. Please ensure you have access and try again."
    }
fi

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
