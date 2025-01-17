# Deploying to Hostgator

Follow these steps to deploy the backend on Hostgator shared hosting.

## Pre-requisites
1. Hostgator shared hosting account
2. SSH access enabled
3. Python application setup in cPanel

## Deployment Steps

### 1. Set up Python App in cPanel
1. Log in to cPanel
2. Go to "Setup Python App"
3. Click "Create Application"
4. Fill in the details:
   - Application root: `/backend` (or your preferred path)
   - Application URL: `your-domain.com/backend`
   - Application startup file: passenger_wsgi.py
   - Python version: 3.8 (or latest available)
   - Application Entry point: application
5. Click "Create"

### 2. Upload Files via FTP
1. Connect to your Hostgator account via FTP
2. Navigate to your Python app directory
3. Upload all files from the `backend-deploy` folder:
   ```
   - main.py
   - passenger_wsgi.py
   - requirements.txt
   - .htaccess
   - static/
   - files/
   ```

### 3. Set Up Virtual Environment
1. Connect to your account via SSH:
```bash
ssh username@your-domain.com
```

2. Navigate to your app directory:
```bash
cd ~/backend
```

3. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

### 4. Configure Files
1. Edit passenger_wsgi.py:
   - Replace YOUR_USERNAME with your Hostgator username
   - Update the Python interpreter path if needed

2. Edit .htaccess:
   - Replace YOUR_USERNAME with your Hostgator username
   - Update the Python path if needed

3. Create upload directory:
```bash
mkdir files
chmod 755 files
```

### 5. Update Application Settings
1. Edit main.py to use relative paths:
   ```python
   app.mount("/files", StaticFiles(directory="./files"), name="files")
   ```

2. Make sure the database path is writable:
   ```python
   conn = sqlite3.connect('./devices.db')
   ```

### 6. Restart Application
1. In cPanel, go to "Setup Python App"
2. Find your application
3. Click "Restart App"

## Testing the Installation

1. Visit your application URL:
```
https://your-domain.com/backend/static/index.html
```

2. Try uploading a file through the interface

3. Check the logs in cPanel's error log viewer

## Updating the Raspberry Pi Configuration

Update the BACKEND_URL in your Raspberry Pi's monitor.service:
```ini
Environment=BACKEND_URL=https://your-domain.com/backend/api
```

## Troubleshooting

1. If you see a 500 error:
   - Check the error logs in cPanel
   - Verify Python path in passenger_wsgi.py
   - Check file permissions

2. If uploads fail:
   - Verify 'files' directory permissions
   - Check disk quota in cPanel

3. If database errors occur:
   - Verify SQLite database file permissions
   - Check if the path is writable

## Important Notes

1. File Permissions:
   - Upload directory: 755
   - Python files: 644
   - Database directory: 755
   - Database file: 664

2. Paths:
   - Use relative paths in the application
   - Store uploaded files in the 'files' directory
   - Keep the database in the application directory

3. Security:
   - Consider adding basic authentication
   - Regularly backup the database
   - Monitor disk usage for uploads
