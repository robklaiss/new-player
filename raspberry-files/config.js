// API Configuration
const API_CONFIG = {
    // Use local video file for testing
    TESTING_MODE: true,
    LOCAL_VIDEO: 'http://localhost/optimized.mp4',
    // API settings
    BASE_URL: window.location.hostname === 'localhost' ? 'http://localhost' : 'https://vinculo.com.py/new-player',
    API_KEY: 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK',
    DEVICE_ID: null,
    PAIRED: false,
    UPDATE_INTERVAL: 60000,
    CONTENT_CHECK_INTERVAL: 30000,
    ENDPOINTS: {
        CONTENT: '/api/content.php',
        UPDATE: '/api/update.php',
        STATUS: '/api/status.php',
        DEVICES: '/api/devices.php',
        DEVICE_CONFIG: '/device_config.json'
    },
    VIDEO_CONFIG: {
        autoRestart: true,
        maxRetries: 3,
        retryDelay: 5000,
        defaultVolume: 1.0,
        hardwareAcceleration: true
    }
};

// Load device configuration
async function loadDeviceConfig() {
    try {
        const response = await fetch(API_CONFIG.ENDPOINTS.DEVICE_CONFIG);
        if (!response.ok) throw new Error('Failed to load device config');
        
        const config = await response.json();
        API_CONFIG.DEVICE_ID = config.device_id;
        API_CONFIG.PAIRED = config.paired || false;
        
        // Show device ID if not paired
        if (!API_CONFIG.PAIRED) {
            showDeviceId(config.device_id);
        }
        
        return config;
    } catch (error) {
        console.error('Error loading device config:', error);
        return null;
    }
}

function showDeviceId(deviceId) {
    const existingElement = document.getElementById('device-id-display');
    if (existingElement) {
        existingElement.remove();
    }

    const deviceIdElement = document.createElement('div');
    deviceIdElement.id = 'device-id-display';
    deviceIdElement.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px;
        border-radius: 5px;
        font-family: monospace;
        z-index: 9999;
        text-align: center;
    `;
    
    deviceIdElement.innerHTML = `
        <h3 style="margin: 0 0 10px 0;">Device ID:</h3>
        <code style="font-size: 24px;">${deviceId}</code>
        <p style="margin: 10px 0 0 0; font-size: 14px;">Enter this ID in the Kiosk Device Manager to pair</p>
    `;
    
    document.body.appendChild(deviceIdElement);
}

// Initialize configuration
loadDeviceConfig();
