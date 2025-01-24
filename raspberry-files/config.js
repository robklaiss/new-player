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
    },
    HEADERS: {
        'X-API-Key': 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK'
    }
};

// Load device configuration
async function loadDeviceConfig() {
    try {
        const response = await fetch(API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.DEVICE_CONFIG, {
            headers: API_CONFIG.HEADERS
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const config = await response.json();
        
        // Update configuration
        if (config.deviceId) {
            API_CONFIG.DEVICE_ID = config.deviceId;
            API_CONFIG.PAIRED = true;
            showDeviceId(config.deviceId);
        }
    } catch (error) {
        console.error('Failed to load device config:', error);
        showDeviceId('ERROR: ' + error.message);
    }
}

// Show device ID on screen
function showDeviceId(deviceId) {
    const deviceIdElement = document.getElementById('device-id');
    if (deviceIdElement) {
        deviceIdElement.textContent = `Device ID: ${deviceId}`;
        deviceIdElement.style.display = 'block';
    } else {
        const deviceIdElement = document.createElement('div');
        deviceIdElement.id = 'device-id';
        deviceIdElement.style.position = 'fixed';
        deviceIdElement.style.top = '50%';
        deviceIdElement.style.left = '50%';
        deviceIdElement.style.transform = 'translate(-50%, -50%)';
        deviceIdElement.style.color = 'white';
        deviceIdElement.style.fontSize = '36px';
        deviceIdElement.style.fontWeight = 'bold';
        deviceIdElement.style.textAlign = 'center';
        deviceIdElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        deviceIdElement.innerHTML = `Device ID: ${deviceId}`;
        document.body.appendChild(deviceIdElement);
    }
}

// Initialize configuration
loadDeviceConfig();
