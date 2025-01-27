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
            self.content_dir = '/var/www/kiosk'
            self.api_url = 'https://vinculo.com.py/new-player/api/update.php'
            self.api_key = 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK'
            self.config_file = '/var/www/kiosk/player/device_config.json'
            self.device_id = self._get_or_create_device_id()
            logging.info(f"Content directory: {self.content_dir}")
            logging.info(f"API URL: {self.api_url}")
            logging.info(f"Device ID: {self.device_id}")
        except Exception as e:
            logging.error(f"Error in __init__: {e}")
            raise

    def _get_or_create_device_id(self):
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    if config.get('device_id'):
                        return config['device_id']
            
            # Generate new device ID if not exists
            import uuid
            device_id = f"device_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"
            
            # Save to config file
            config = {'device_id': device_id, 'paired': False}
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, 'w') as f:
                json.dump(config, f)
            
            return device_id
        except Exception as e:
            logging.error(f"Error generating device ID: {e}")
            return f"device_error_{int(time.time())}"

    def is_device_paired(self):
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    return config.get('paired', False)
            return False
        except Exception as e:
            logging.error(f"Error checking device pairing: {e}")
            return False

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
                'Authorization': f'Bearer {self.api_key}',
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
                json=data,
                headers=headers,
                timeout=10
            )
            
            logging.info(f"Response status code: {response.status_code}")
            if response.status_code == 401:
                logging.error("Authentication failed. Please verify API key.")
                return False
            elif response.status_code == 403:
                logging.error("Access forbidden. Please verify device ID and permissions.")
                return False
            
            logging.info(f"Response text: {response.text}")
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            logging.error(f"Network error sending ping: {e}")
            return False
        except Exception as e:
            logging.error(f"Error sending ping: {e}")
            return False

    def check_pairing_status(self):
        try:
            response = requests.get(
                f"{self.api_url.replace('update.php', 'devices.php')}",
                headers={'Authorization': f'Bearer {self.api_key}'}
            )
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    devices = data.get('devices', [])
                    for device in devices:
                        if device.get('id') == self.device_id:
                            is_paired = device.get('paired', False)
                            # Update local config
                            config = {'device_id': self.device_id, 'paired': is_paired}
                            with open(self.config_file, 'w') as f:
                                json.dump(config, f)
                            return is_paired
            return False
        except Exception as e:
            logging.error(f"Error checking pairing status: {e}")
            return False

    def run(self):
        while True:
            try:
                # Check pairing status
                is_paired = self.check_pairing_status()
                logging.info(f"Device pairing status: {'paired' if is_paired else 'not paired'}")

                # Only send updates if device is paired
                if is_paired:
                    system_info = self.get_system_info()
                    self.send_ping()
                
                time.sleep(60)  # Check every minute
            except Exception as e:
                logging.error(f"Error in main loop: {e}")
                time.sleep(60)  # Wait before retrying

if __name__ == "__main__":
    try:
        logging.info("Creating DeviceMonitor instance")
        monitor = DeviceMonitor()
        logging.info("Starting monitor")
        monitor.run()
    except Exception as e:
        logging.error(f"Fatal error: {e}")
        sys.exit(1)
