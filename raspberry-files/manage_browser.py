#!/usr/bin/env python3
import subprocess
import time
import os
import signal
import logging

def setup_logging():
    logging.basicConfig(
        filename='/var/log/browser_manager.log',
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )

def kill_existing_chromium():
    try:
        # Kill any existing Chromium processes
        subprocess.run(['pkill', 'chromium'])
        time.sleep(2)  # Give time for processes to close
    except Exception as e:
        logging.error(f"Error killing existing Chromium: {e}")

def start_chromium():
    try:
        # Start Chromium in kiosk mode
        cmd = [
            'chromium-browser',
            '--kiosk',  # Full screen mode
            '--noerrdialogs',  # Don't show error dialogs
            '--disable-session-crashed-bubble',  # Disable crash recovery bubble
            '--disable-infobars',  # Disable infobars
            '--check-for-update-interval=31536000',  # Check for updates once a year
            '--disable-features=TranslateUI',  # Disable translation UI
            '--autoplay-policy=no-user-gesture-required',  # Allow autoplay
            'https://vinculo.com.py/new-player/admin/display'  # Updated URL
        ]
        
        logging.info("Starting Chromium with command: %s", ' '.join(cmd))
        
        # Use subprocess.Popen to keep the process running
        process = subprocess.Popen(cmd)
        return process
    except Exception as e:
        logging.error(f"Error starting Chromium: {e}")
        return None

def main():
    setup_logging()
    logging.info("Starting browser manager")
    
    # Kill any existing Chromium instances
    kill_existing_chromium()
    
    # Start Chromium
    browser_process = start_chromium()
    
    if browser_process:
        try:
            # Keep the script running and monitor the browser process
            while True:
                if browser_process.poll() is not None:
                    logging.warning("Browser process ended, restarting...")
                    kill_existing_chromium()
                    browser_process = start_chromium()
                time.sleep(5)
        except KeyboardInterrupt:
            logging.info("Received shutdown signal")
            if browser_process:
                browser_process.terminate()
    else:
        logging.error("Failed to start browser process")

if __name__ == "__main__":
    main()
