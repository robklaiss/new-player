// API Configuration
const API_CONFIG = {
    BASE_URL: 'http://vinculo.com.py/new-player/api',
    API_KEY: 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK',
    DEVICE_ID: 'device_20250119_06395bce', // Your registered device ID
    UPDATE_INTERVAL: 60000, // Status update interval in milliseconds (1 minute)
    CONTENT_CHECK_INTERVAL: 30000,  // Check for new content every 30 seconds
    ENDPOINTS: {
        CONTENT: '/content.php',
        UPDATE: '/update.php',
        STATUS: '/status.php'
    },
    VIDEO_CONFIG: {
        autoRestart: true,
        maxRetries: 3,
        retryDelay: 5000, // 5 seconds between retries
        defaultVolume: 1.0
    },
    CORS_MODE: true
};
