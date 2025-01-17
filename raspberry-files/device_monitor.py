#!/usr/bin/env python3
import os
import json
import time
import uuid
import requests
import hashlib
import logging
from datetime import datetime
import subprocess

class DeviceMonitor:
    def __init__(self):
        self.config_file = '/var/www/kiosk/device_config.json'
        self.content_dir = '/var/www/kiosk'
        # Use environment variable or default to localhost
        self.api_url = os.environ.get('BACKEND_URL', 'http://localhost:8080/api')
        self.device_id = self.get_device_id()
        self.setup_logging()

    def setup_logging(self):
        logging.basicConfig(
            filename='/var/log/device_monitor.log',
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )

    def get_device_id(self):
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    return config.get('device_id')
            except:
                pass
        
        # Generate new device ID if none exists
        device_id = str(uuid.uuid4())
        os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
        with open(self.config_file, 'w') as f:
            json.dump({'device_id': device_id}, f)
        return device_id

    def get_system_info(self):
        try:
            cpu_temp = subprocess.check_output(['vcgencmd', 'measure_temp']).decode()
            memory = subprocess.check_output(['free', '-m']).decode().split('\n')[1].split()
            disk = subprocess.check_output(['df', '-h', '/']).decode().split('\n')[1].split()
            
            return {
                'cpu_temperature': cpu_temp.replace('temp=', '').strip(),
                'memory_total': memory[1],
                'memory_used': memory[2],
                'disk_total': disk[1],
                'disk_used': disk[2],
                'disk_percent': disk[4]
            }
        except Exception as e:
            logging.error(f"Error getting system info: {e}")
            return {}

    def calculate_file_hash(self, filepath):
        sha256_hash = hashlib.sha256()
        with open(filepath, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def get_content_info(self):
        content_info = {}
        for filename in ['index.html', 'video.mp4', 'update.json']:
            filepath = os.path.join(self.content_dir, filename)
            if os.path.exists(filepath):
                content_info[filename] = {
                    'hash': self.calculate_file_hash(filepath),
                    'size': os.path.getsize(filepath),
                    'last_modified': datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                }
        return content_info

    def send_ping(self):
        try:
            data = {
                'device_id': self.device_id,
                'timestamp': datetime.now().isoformat(),
                'system_info': self.get_system_info(),
                'content_info': self.get_content_info()
            }
            
            response = requests.post(f"{self.api_url}/ping", json=data)
            response.raise_for_status()
            
            # Check for updates
            updates = response.json().get('updates', [])
            if updates:
                self.process_updates(updates)
                
            logging.info("Ping successful")
            return True
        except Exception as e:
            logging.error(f"Error sending ping: {e}")
            return False

    def process_updates(self, updates):
        for update in updates:
            try:
                file_url = update['url']
                file_path = os.path.join(self.content_dir, update['filename'])
                
                # Download file
                response = requests.get(file_url, stream=True)
                response.raise_for_status()
                
                # Save file
                with open(file_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                logging.info(f"Successfully updated {update['filename']}")
            except Exception as e:
                logging.error(f"Error processing update for {update.get('filename')}: {e}")

    def run(self):
        while True:
            self.send_ping()
            time.sleep(300)  # Wait 5 minutes

if __name__ == "__main__":
    monitor = DeviceMonitor()
    monitor.run()
