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
        self.config_file = '/var/www/kiosk/config.js'
        self.content_dir = '/var/www/kiosk'
        self.api_url = 'https://vinculo.com.py/new-player/api'
        self.api_key = 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK'
        self.device_id = 'device_20250119_06395bce'
        self.setup_logging()

    def setup_logging(self):
        logging.basicConfig(
            filename='/var/log/device_monitor.log',
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )

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
            
            headers = {
                'X-API-Key': self.api_key,
                'X-Device-Id': self.device_id
            }
            
            response = requests.post(f"{self.api_url}/ping.php", json=data, headers=headers)
            response.raise_for_status()
            logging.info(f"Ping sent successfully: {response.text}")
            return response.json()
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
