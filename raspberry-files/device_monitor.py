#!/usr/bin/env python3
import os
import json
import time
import logging
from datetime import datetime
import subprocess
import sys

try:
    import requests
except ImportError:
    logging.error("Requests module not found. Installing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests"])
    import requests

class DeviceMonitor:
    def __init__(self):
        self.config_file = '/var/www/kiosk/config.js'
        self.content_dir = '/var/www/kiosk'
        self.api_url = 'https://vinculo.com.py/new-player/api'
        self.api_key = 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK'
        self.device_id = 'device_20250119_06395bce'
        self.setup_logging()
        logging.info("Device Monitor initialized with device_id: %s", self.device_id)

    def setup_logging(self):
        log_file = '/var/log/device_monitor.log'
        try:
            # Ensure log directory exists and has correct permissions
            os.makedirs(os.path.dirname(log_file), exist_ok=True)
            if not os.path.exists(log_file):
                open(log_file, 'a').close()
            os.chmod(log_file, 0o666)
        except Exception as e:
            print(f"Error setting up log file: {e}")
            # Fallback to console logging if file logging fails
            logging.basicConfig(
                level=logging.INFO,
                format='%(asctime)s - %(levelname)s - %(message)s'
            )
            return

        logging.basicConfig(
            filename=log_file,
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        # Also log to console
        console = logging.StreamHandler()
        console.setLevel(logging.INFO)
        logging.getLogger('').addHandler(console)

    def get_system_info(self):
        info = {}
        try:
            # Memory info
            with open('/proc/meminfo') as f:
                mem = f.readlines()
            total = int(mem[0].split()[1])
            free = int(mem[1].split()[1])
            info['memory_total'] = str(total // 1024) + 'MB'
            info['memory_used'] = str((total - free) // 1024) + 'MB'

            # Disk info
            disk = subprocess.check_output(['df', '-h', '/']).decode().split('\n')[1].split()
            info['disk_total'] = disk[1]
            info['disk_used'] = disk[2]
            info['disk_percent'] = disk[4]

            # Try to get CPU temp on Raspberry Pi
            try:
                temp = subprocess.check_output(['vcgencmd', 'measure_temp']).decode()
                info['cpu_temperature'] = temp.replace('temp=', '').strip()
            except:
                info['cpu_temperature'] = 'N/A'

        except Exception as e:
            logging.error(f"Error getting system info: {e}")
            info['error'] = str(e)

        return info

    def get_content_info(self):
        content_info = {}
        try:
            for filename in ['index.html', 'config.js', 'service-worker.js']:
                filepath = os.path.join(self.content_dir, filename)
                if os.path.exists(filepath):
                    content_info[filename] = {
                        'size': os.path.getsize(filepath),
                        'last_modified': datetime.fromtimestamp(os.path.getmtime(filepath)).isoformat()
                    }
        except Exception as e:
            logging.error(f"Error getting content info: {e}")
            content_info['error'] = str(e)
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
            
            logging.info(f"Sending ping to {self.api_url}/ping.php")
            response = requests.post(f"{self.api_url}/ping.php", 
                                  json=data, 
                                  headers=headers,
                                  timeout=10)
            response.raise_for_status()
            logging.info(f"Ping response: {response.text}")
            return response.json()
        except requests.exceptions.RequestException as e:
            logging.error(f"Network error sending ping: {e}")
            return False
        except Exception as e:
            logging.error(f"Error sending ping: {e}")
            return False

    def run(self):
        logging.info("Starting device monitor")
        while True:
            try:
                self.send_ping()
                time.sleep(60)  # Ping every minute
            except KeyboardInterrupt:
                logging.info("Shutting down device monitor")
                break
            except Exception as e:
                logging.error(f"Error in main loop: {e}")
                time.sleep(60)  # Wait before retrying

if __name__ == "__main__":
    try:
        monitor = DeviceMonitor()
        monitor.run()
    except Exception as e:
        logging.error(f"Fatal error: {e}")
        sys.exit(1)
