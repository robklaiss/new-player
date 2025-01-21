#!/usr/bin/env python3
import os
import json
import time
import logging
from datetime import datetime
import subprocess
import sys
import socket

# Setup basic console logging first
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/var/log/device_monitor.log')
    ]
)

print("Starting device monitor script")
logging.info("Initializing device monitor")

try:
    import requests
    logging.info("Successfully imported requests")
except ImportError as e:
    logging.error(f"Failed to import requests: {e}")
    sys.exit(1)

class DeviceMonitor:
    def __init__(self):
        try:
            logging.info("Initializing DeviceMonitor class")
            self.content_dir = '/var/www/kiosk/player'
            self.api_url = 'https://vinculo.com.py/new-player/api/update.php'
            self.api_key = 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK'
            self.device_id = 'device_20250119_06395bce'
            logging.info(f"Content directory: {self.content_dir}")
            logging.info(f"API URL: {self.api_url}")
            logging.info(f"Device ID: {self.device_id}")
        except Exception as e:
            logging.error(f"Error in __init__: {e}")
            raise

    def get_system_info(self):
        info = {}
        try:
            # Disk info
            disk = subprocess.check_output(['df', '-h', '/']).decode().split('\n')[1].split()
            info['disk_total'] = disk[1]
            info['disk_used'] = disk[2]
            info['disk_percent'] = disk[4]

            # Network info
            hostname = socket.gethostname()
            ip = subprocess.check_output(['hostname', '-I']).decode().strip()
            info['hostname'] = hostname
            info['ip'] = ip

            # Memory info
            mem = subprocess.check_output(['free', '-h']).decode().split('\n')[1].split()
            info['memory_total'] = mem[1]
            info['memory_used'] = mem[2]

            # System uptime
            uptime = subprocess.check_output(['uptime']).decode().strip()
            info['uptime'] = uptime

            logging.info(f"System info collected: {info}")
        except Exception as e:
            logging.error(f"Error getting system info: {e}")
            info['error'] = str(e)
        return info

    def send_ping(self):
        try:
            system_info = self.get_system_info()
            
            data = {
                'status': {
                    'disk': system_info,
                    'timestamp': datetime.now().isoformat(),
                    'version': '1.0',
                    'current_video': None,
                    'errors': None,
                    'device_type': 'raspberry_pi',
                    'online': True
                }
            }
            
            headers = {
                'X-API-Key': self.api_key,
                'X-Device-Id': self.device_id,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'InfoActive-Kiosk/1.0'
            }
            
            logging.info(f"Sending ping to {self.api_url}")
            logging.debug(f"Headers: {headers}")
            logging.debug(f"Data: {data}")
            
            response = requests.post(
                self.api_url,
                data=json.dumps(data),
                headers=headers,
                timeout=10
            )
            
            logging.info(f"Response status code: {response.status_code}")
            logging.info(f"Response text: {response.text}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Network error sending ping: {e}")
            return False
        except Exception as e:
            logging.error(f"Error sending ping: {e}")
            return False

    def run(self):
        logging.info("Starting main loop")
        while True:
            try:
                result = self.send_ping()
                logging.info(f"Ping result: {result}")
                time.sleep(60)
            except KeyboardInterrupt:
                logging.info("Shutting down")
                break
            except Exception as e:
                logging.error(f"Error in main loop: {e}")
                time.sleep(60)

if __name__ == "__main__":
    try:
        logging.info("Creating DeviceMonitor instance")
        monitor = DeviceMonitor()
        logging.info("Starting monitor")
        monitor.run()
    except Exception as e:
        logging.error(f"Fatal error: {e}")
        sys.exit(1)
