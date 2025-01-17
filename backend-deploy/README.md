# Kiosk Management Backend Deployment

This folder contains everything needed to deploy the management backend for the kiosk system.

## Directory Structure
```
backend-deploy/
├── main.py              # FastAPI server application
├── requirements.txt     # Python dependencies
├── files/              # Directory for uploaded content
└── static/             # Web interface files
    └── index.html      # Management dashboard
```

## Deployment Steps

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Make sure the `files` directory exists and is writable:
```bash
mkdir -p files
chmod 755 files
```

3. Start the server:
```bash
# For testing
uvicorn main:app --host 0.0.0.0 --port 8080

# For production (using gunicorn)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8080
```

## Production Deployment Notes

1. Use a process manager (PM2 or Supervisor):
```bash
# Using PM2
pm2 start "gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:8080" --name kiosk-backend
```

2. Set up Nginx as reverse proxy:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Configure SSL with Let's Encrypt

4. Set proper file permissions:
```bash
sudo chown -R www-data:www-data files/
sudo chmod 755 files/
```

## After Deployment

1. Access the dashboard at:
```
http://your-server:8080/static/index.html
```

2. Update all Raspberry Pi devices with the new backend URL:
```bash
sudo nano /etc/systemd/system/monitor.service
# Update: Environment=BACKEND_URL=http://your-server:8080/api
sudo systemctl daemon-reload
sudo systemctl restart monitor.service
```
