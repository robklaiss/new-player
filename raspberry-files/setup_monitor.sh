#!/bin/bash

# Exit on any error
set -e

echo "Setting up monitor service..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Create infoactive user if it doesn't exist
if ! id "infoactive" &>/dev/null; then
    echo "Creating infoactive user..."
    useradd -m infoactive
    # Add to necessary groups
    usermod -a -G video,audio,input infoactive
fi

# Create and set up kiosk directory
echo "Setting up kiosk directory..."
mkdir -p /var/www/kiosk
cp ./* /var/www/kiosk/
chown -R infoactive:infoactive /var/www/kiosk
chmod +x /var/www/kiosk/*.py
chmod +x /var/www/kiosk/*.sh

# Install Python3 and pip if not present
echo "Installing Python dependencies..."
if ! command -v python3 &>/dev/null; then
    apt-get update
    apt-get install -y python3 python3-pip
fi

# Install Python requirements
pip3 install -r requirements.txt

# Install and enable the service
echo "Setting up systemd service..."
cp monitor.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable monitor.service
systemctl start monitor.service

# Check service status
echo "Checking service status..."
systemctl status monitor.service

echo "Setup complete! Monitor service should now be running."
echo "You can check the status anytime with: sudo systemctl status monitor.service"
echo "View logs with: sudo journalctl -u monitor.service -f"
