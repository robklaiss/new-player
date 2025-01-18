# Raspberry Pi Kiosk Player Files

This directory contains all the files needed to set up a Raspberry Pi as a kiosk video player.

## Directory Structure
```
raspberry-files/
├── index.html          # Main video player page
├── service-worker.js   # Service worker for offline caching
├── config.js          # Configuration file
├── manifest.json      # PWA manifest
├── icon-192.png      # PWA icon (192x192)
├── icon-512.png      # PWA icon (512x512)
├── start-kiosk.sh    # Startup script
└── kiosk.service     # Systemd service for kiosk
```

## Installation Steps

1. Install system dependencies:
```bash
sudo apt update
sudo apt install -y firefox-esr unclutter x11-xserver-utils curl
```

2. Create the web directory and copy files:
```bash
sudo mkdir -p /var/www/kiosk
sudo cp index.html service-worker.js config.js manifest.json icon-192.png icon-512.png start-kiosk.sh /var/www/kiosk/
sudo chmod +x /var/www/kiosk/start-kiosk.sh
```

3. Set up Firefox for kiosk mode:
```bash
# Create Firefox profile directory
sudo mkdir -p /var/www/kiosk/.firefox
sudo chown -R infoactive:infoactive /var/www/kiosk/.firefox

# Enable service workers
mkdir -p /home/infoactive/.mozilla/firefox/
cat > /home/infoactive/.mozilla/firefox/user.js << EOL
user_pref("dom.serviceWorkers.enabled", true);
user_pref("dom.webworkers.enabled", true);
user_pref("dom.serviceWorkers.testing.enabled", true);
EOL
sudo chown -R infoactive:infoactive /home/infoactive/.mozilla
```

4. Install system service:
```bash
sudo cp kiosk.service /etc/systemd/system/
```

5. Set proper permissions:
```bash
sudo chown -R infoactive:infoactive /var/www/kiosk
sudo chmod 644 /var/www/kiosk/*
sudo chmod +x /var/www/kiosk/start-kiosk.sh
```

6. Enable and start service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable kiosk.service
sudo systemctl start kiosk.service
```

## Server Setup

1. Create required directories on your server:
```bash
mkdir -p /new-player/api/videos
mkdir -p /new-player/api/logs
mkdir -p /new-player/api/data
```

2. Copy API files:
```bash
cp api/config.php api/content.php api/update.php api/test.php /new-player/api/
```

3. Set permissions:
```bash
chmod 755 /new-player/api
chmod 644 /new-player/api/*.php
chmod 755 /new-player/api/videos
chmod 755 /new-player/api/logs
chmod 755 /new-player/api/data
```

4. Edit config.php to set your API key:
```php
define('API_KEY', 'your-secure-api-key-here');  // Change this!
```

5. Upload your video files to `/new-player/api/videos/`

6. Test the API:
```bash
curl -H "X-API-Key: your-api-key" -H "X-Device-Id: test-device" https://vinculo.com.py/new-player/api/test.php
```

## Quick Installation

After setting up access, run this command to install everything:

```bash
cd /var/www && sudo git clone --depth 1 git@github.com:robklaiss/new-player.git kiosk && sudo bash kiosk/raspberry-files/install.sh
```

## Monitoring

Check service status:
```bash
sudo systemctl status kiosk.service
```

View logs:
```bash
sudo journalctl -u kiosk.service -f
tail -f /var/log/kiosk.log
```

## Troubleshooting

1. If you see "Service workers are not supported":
   - Check that Firefox's service worker settings are enabled in user.js
   - Make sure you're using HTTPS or localhost
   - Check Firefox's console (Ctrl+Shift+K) for specific errors

2. If video doesn't play:
   - Check /var/log/kiosk.log for errors
   - Verify video file exists on server
   - Check API key and device ID are correct
   - Verify network connectivity

3. If kiosk doesn't start:
   - Check systemd service status
   - Verify X server is running
   - Check file permissions
   - Look for errors in journalctl
