# Important Paths and Configurations

## Repository Location
- Local development: `/System/Volumes/Data/Proyectos Temp/infoactive 2024/new-player`
- Raspberry Pi: `/tmp/new-player`

## System Paths
- Web root: `/var/www/kiosk`
- Systemd service: `/etc/systemd/system/kiosk.service`
- Kiosk script: `/var/www/kiosk/kiosk.sh`

## User Configuration
- Username: `infoactive`
- Home directory: `/home/infoactive`
- Xauthority file: `/home/infoactive/.Xauthority`
- Runtime directory: `/run/user/1000`

## Environment Variables
- DISPLAY=:0
- WAYLAND_DISPLAY=wayland-0
- XDG_SESSION_TYPE=wayland
- XDG_RUNTIME_DIR=/run/user/1000
- HOME=/home/infoactive
- XAUTHORITY=/home/infoactive/.Xauthority

## Common Commands
```bash
# Update service
sudo cp raspberry-files/kiosk.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart kiosk.service

# Check service status
sudo systemctl status kiosk.service
journalctl -u kiosk.service -f

# Repository operations
cd /tmp/new-player
git pull