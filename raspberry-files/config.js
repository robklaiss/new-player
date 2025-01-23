// API Configuration
const API_CONFIG = {
    // API settings
    BASE_URL: 'https://vinculo.com.py/new-player',
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
        DEVICE_CONFIG: '/device_config.json',
        VIDEOS: '/videos'  // Directory containing videos
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
        const response = await fetch(API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.DEVICE_CONFIG);
        const config = await response.json();
        
        if (config.device_id) {
            API_CONFIG.DEVICE_ID = config.device_id;
            API_CONFIG.PAIRED = true;
            return true;
        }
        
        // Generate device ID if not configured
        if (!API_CONFIG.DEVICE_ID) {
            API_CONFIG.DEVICE_ID = 'KIOSK_' + Math.random().toString(36).substr(2, 9);
            showDeviceId(API_CONFIG.DEVICE_ID);
        }
        
        return false;
    } catch (error) {
        console.error('Error loading device config:', error);
        return false;
    }
}

// Show device ID on screen
function showDeviceId(deviceId) {
    const deviceIdElement = document.createElement('div');
    deviceIdElement.style.position = 'fixed';
    deviceIdElement.style.top = '50%';
    deviceIdElement.style.left = '50%';
    deviceIdElement.style.transform = 'translate(-50%, -50%)';
    deviceIdElement.style.color = 'white';
    deviceIdElement.style.fontSize = '36px';
    deviceIdElement.style.fontWeight = 'bold';
    deviceIdElement.style.textAlign = 'center';
    deviceIdElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
    deviceIdElement.innerHTML = `
        <div>Device ID:</div>
        <div style="font-size: 48px; margin-top: 20px;">${deviceId}</div>
        <div style="font-size: 24px; margin-top: 20px;">Enter this ID in the admin panel to pair the device</div>
    `;
    document.body.appendChild(deviceIdElement);
}

// Initialize configuration
loadDeviceConfig();
