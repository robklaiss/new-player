# Raspberry Pi Kiosk Player Files

This directory contains all the files needed to set up a Raspberry Pi as a kiosk video player.

## Directory Structure
```
raspberry-files/
├── index.html          # Main video player page
├── service-worker.js   # Service worker for offline caching
├── update.json        # Content manifest
├── device_monitor.py  # Monitoring and update service
├── start-kiosk.sh    # Startup script
├── kiosk.service     # Systemd service for kiosk
├── monitor.service   # Systemd service for monitoring
└── requirements.txt  # Python dependencies
```

## Installation Steps

1. Install system dependencies:
```bash
sudo apt-get update
sudo apt-get install -y python3-pip chromium-browser unclutter x11-xserver-utils
```

2. Create the web directory and copy files:
```bash
sudo mkdir -p /var/www/kiosk
sudo cp index.html update.json service-worker.js device_monitor.py start-kiosk.sh /var/www/kiosk/
sudo chmod +x /var/www/kiosk/start-kiosk.sh
```

3. Install Python dependencies:
```bash
sudo apt-get install python3-requests
```

4. Install system services:
```bash
sudo cp kiosk.service monitor.service /etc/systemd/system/
```

5. The monitor service is pre-configured to use the backend at vinculo.com.py/new-player/api

6. Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable kiosk.service monitor.service
sudo systemctl start kiosk.service monitor.service
```

## Kiosk Player Installation

### Repository Access Setup

Since this is a private repository, you'll need to set up access before installation. There are two options:

### Option 1: SSH Key (Recommended)

1. Generate an SSH key on your Raspberry Pi:
```bash
sudo -u pi ssh-keygen -t ed25519 -C "raspberry-kiosk"
```

2. Display the public key:
```bash
sudo -u pi cat /home/pi/.ssh/id_ed25519.pub
```

3. Add the key to GitHub:
   - Go to the repository settings
   - Navigate to "Deploy keys"
   - Click "Add deploy key"
   - Paste the key and give it a name (e.g., "Raspberry Pi Kiosk")
   - Check "Allow write access" if needed
   - Click "Add key"

### Option 2: Make Repository Public (Temporary)

If you prefer, you can temporarily make the repository public for installation. Remember to make it private again after setup.

## Quick Installation

After setting up access, run this command to install everything:

```bash
cd /var/www && sudo git clone --depth 1 git@github.com:robklaiss/new-player.git kiosk && sudo bash kiosk/raspberry-files/install.sh
```

Or if you prefer step by step:

```bash
# Clone the repository
cd /var/www
sudo git clone --depth 1 git@github.com:robklaiss/new-player.git kiosk

# Run the installation script
cd kiosk
sudo bash raspberry-files/install.sh
```

The script will:
1. Install all required packages
2. Set up the display manager
3. Configure the services
4. Set appropriate permissions
5. Start the kiosk

### Initial Setup

1. Configure Raspberry Pi to boot to desktop:
```bash
sudo raspi-config
```
Navigate to:
- System Options
- Boot / Auto Login
- Select "Desktop Autologin"

2. Install required packages:
```bash
sudo apt update
sudo apt install -y chromium-browser unclutter xserver-xorg x11-xserver-utils python3-flask python3-requests
```

3. Set up the kiosk:
```bash
# Clone the repository
cd /var/www
sudo git clone https://github.com/robklaiss/new-player.git kiosk

# Copy and set up service files
sudo cp /var/www/kiosk/raspberry-files/kiosk.service /etc/systemd/system/
sudo chmod +x /var/www/kiosk/raspberry-files/start-kiosk.sh
sudo cp /var/www/kiosk/raspberry-files/start-kiosk.sh /var/www/kiosk/

# Enable and start the service
sudo systemctl daemon-reload
sudo systemctl enable kiosk.service
sudo systemctl start kiosk.service
```

## Troubleshooting

If the system boots to CLI instead of desktop:

1. Check boot configuration:
```bash
sudo raspi-config
```
Ensure "Desktop Autologin" is selected under System Options > Boot / Auto Login

2. Verify X server is installed and running:
```bash
sudo apt install --reinstall xserver-xorg xserver-xorg-core
sudo apt install --reinstall raspberrypi-ui-mods
```

3. Check service status:
```bash
sudo systemctl status kiosk.service
sudo tail -f /var/log/kiosk.log
```

4. Check permissions:
```bash
sudo chown -R pi:pi /var/www/kiosk
sudo usermod -a -G video pi
ls -l /home/pi/.Xauthority  # Should be owned by pi:pi
```

5. If issues persist, try:
```bash
# Restart the display manager
sudo systemctl restart lightdm

# Enable the service again
sudo systemctl enable kiosk.service

# Check if display is set
echo $DISPLAY  # Should show :0

# Test X server
DISPLAY=:0 xset q
```

## Updating

To update the kiosk player:
```bash
cd /var/www/kiosk
sudo git pull
sudo systemctl restart kiosk.service
```

## Monitoring

You can check the status of the services using:
```bash
sudo systemctl status kiosk.service
sudo systemctl status monitor.service
```

View logs:
```bash
sudo journalctl -u kiosk.service
sudo journalctl -u monitor.service
```

Device monitoring logs are also available at:
```bash
sudo tail -f /var/log/device_monitor.log
