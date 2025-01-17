# Raspberry Pi Kiosk Player Files

This directory contains all the files needed to set up a Raspberry Pi as a kiosk video player.

## Directory Structure
```
raspberry-files/
├── index.html          # Main video player page
├── service-worker.js   # Service worker for offline caching
├── update.json        # Content manifest
├── video.mp4         # Your video file (replace this with your actual video)
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
sudo cp index.html video.mp4 update.json service-worker.js device_monitor.py start-kiosk.sh /var/www/kiosk/
sudo chmod +x /var/www/kiosk/start-kiosk.sh
```

3. Install Python dependencies:
```bash
sudo pip3 install -r requirements.txt
```

4. Install system services:
```bash
sudo cp kiosk.service monitor.service /etc/systemd/system/
```

5. Edit the monitor service to set your backend URL:
```bash
sudo nano /etc/systemd/system/monitor.service
# Update: Environment=BACKEND_URL=http://your-server:8080/api
```

6. Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable kiosk.service monitor.service
sudo systemctl start kiosk.service monitor.service
```

## Updating Content

The device will automatically check for updates every 5 minutes. When new content is available on the backend server, it will:
1. Download the new content
2. Update the local cache
3. Refresh the display if needed

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
```
