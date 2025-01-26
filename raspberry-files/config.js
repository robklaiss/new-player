// API Configuration
const API_CONFIG = {
    // API settings
    BASE_URL: 'https://vinculo.com.py/new-player',
    API_KEY: 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK',
    DEVICE_ID: 'KIOSK-VERANO-2025',
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
        retryDelay: 5000
    }
};

// Export configuration
window.API_CONFIG = API_CONFIG;
