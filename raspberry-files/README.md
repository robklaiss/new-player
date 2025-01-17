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
sudo apt-get install -y python3-pip chromium-browser
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
