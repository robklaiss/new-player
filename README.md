# Kiosk Video Player System

A distributed system for managing video content across multiple Raspberry Pi kiosk displays.

## System Components

### 1. Kiosk Player
- HTML5 video player with offline support
- Service Worker for caching
- Automatic content updates
- System monitoring

### 2. Device Monitor
- System health monitoring
- Content synchronization
- Automatic updates
- Periodic status reporting

### 3. Management Backend
- Device status dashboard
- Content management
- File distribution
- System monitoring

## Directory Structure
```
.
├── backend/                 # Backend server
│   ├── main.py             # FastAPI server
│   ├── requirements.txt    # Backend dependencies
│   └── static/             # Web interface
├── device_monitor.py       # Device monitoring service
├── index.html             # Kiosk player
├── service-worker.js      # Offline caching
├── update.json           # Content manifest
├── kiosk.service         # Systemd service for kiosk
├── monitor.service       # Systemd service for monitor
└── requirements.txt      # Device dependencies
```

## Installation

### On Raspberry Pi (Kiosk)

1. Install dependencies:
```bash
sudo apt-get update
sudo apt-get install -y python3-pip chromium-browser
sudo pip3 install -r requirements.txt
```

2. Set up the web directory:
```bash
sudo mkdir -p /var/www/kiosk
sudo cp index.html video.mp4 update.json service-worker.js device_monitor.py /var/www/kiosk/
```

3. Install system services:
```bash
sudo cp kiosk.service monitor.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable kiosk.service monitor.service
sudo systemctl start kiosk.service monitor.service
```

### Backend Server

1. Install dependencies:
```bash
cd backend
pip install -r requirements.txt
mkdir files
```

2. Start the server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8080
```

## Configuration

### Device Monitor
Edit the `monitor.service` file to set your backend URL:
```ini
Environment=BACKEND_URL=http://YOUR_SERVER_IP:8080/api
```

### Backend Server
The backend server needs to be accessible to all Raspberry Pi devices. You can:
- Host it on a local network server
- Deploy it to a cloud provider (recommended for production)

## Usage

1. Access the management dashboard:
```
http://YOUR_SERVER_IP:8080/static/index.html
```

2. Upload content through the web interface

3. Monitor device status and health

4. Devices will automatically:
   - Download new content
   - Cache for offline playback
   - Report status every 5 minutes
   - Restart if crashes occur

## Development

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/kiosk-player.git
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
cd backend
pip install -r requirements.txt
```

## License

MIT License - See LICENSE file for details
