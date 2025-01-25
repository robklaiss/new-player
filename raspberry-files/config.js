// API Configuration
const API_CONFIG = {
    // API settings
    BASE_URL: 'https://vinculo.com.py/new-player',
    API_KEY: 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK',
    DEVICE_ID: 'device_20250119_06395bce', // Specific device ID
    PAIRED: true,
    UPDATE_INTERVAL: 60000,
    CONTENT_CHECK_INTERVAL: 30000,
    ENDPOINTS: {
        CONTENT: '/api/content.php',
        UPDATE: '/api/update.php',
        STATUS: '/api/status.php',
        DEVICES: '/api/devices.php',
        DEVICE_CONFIG: '/device_config.json',
        VIDEOS: '/videos'
    },
    VIDEO_CONFIG: {
        autoRestart: true,
        maxRetries: 3,
        retryDelay: 5000,
        defaultVolume: 1.0,
        hardwareAcceleration: true,
        // Video playback settings
        playbackRate: 1.0,
        preload: 'auto',
        loop: true,
        muted: true,
        playsInline: true,
        // Performance optimizations
        bufferingGoal: 2, // seconds
        maxBufferLength: 30, // seconds
        backBufferLength: 30, // seconds
        // Hardware acceleration
        forceHardwareAcceleration: true,
        useRequestVideoFrameCallback: true
    },
    HEADERS: {
        'X-Device-Id': 'device_20250119_06395bce',
        'X-API-Key': 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK',
        'Content-Type': 'application/json'
    }
};

// Load device configuration
async function loadDeviceConfig() {
    try {
        const response = await fetch(API_CONFIG.BASE_URL + API_CONFIG.ENDPOINTS.DEVICE_CONFIG, {
            headers: API_CONFIG.HEADERS,
            timeout: 5000 // 5 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const config = await response.json();
        
        if (config.deviceId) {
            API_CONFIG.DEVICE_ID = config.deviceId;
            API_CONFIG.PAIRED = true;
            showDeviceId(config.deviceId);
        }
    } catch (error) {
        console.warn('Running in offline mode:', error);
        showDeviceId('LOCAL-KIOSK');
    }
}

// Show device ID on screen
function showDeviceId(deviceId) {
    const deviceIdElement = document.getElementById('deviceId');
    if (deviceIdElement) {
        deviceIdElement.textContent = `Device ID: ${deviceId}`;
        // Hide after 10 seconds if we're in local mode
        if (deviceId === 'LOCAL-KIOSK') {
            setTimeout(() => {
                deviceIdElement.style.opacity = '0';
                deviceIdElement.style.transition = 'opacity 1s';
            }, 10000);
        }
    } else {
        const deviceIdElement = document.createElement('div');
        deviceIdElement.id = 'deviceId';
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
