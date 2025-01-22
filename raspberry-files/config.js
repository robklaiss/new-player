// API Configuration
const API_CONFIG = {
    // Use local video file for testing
    TESTING_MODE: true,
    LOCAL_VIDEO: 'http://localhost:8000/optimized.mp4',
    // API settings
    BASE_URL: window.location.hostname === 'localhost' ? 'http://localhost:8000/api' : 'https://vinculo.com.py/new-player',
    API_KEY: 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK',
    DEVICE_ID: 'device_20250119_06395bce', // Your registered device ID
    UPDATE_INTERVAL: 60000, // Status update interval in milliseconds (1 minute)
    CONTENT_CHECK_INTERVAL: 30000,  // Check for new content every 30 seconds
    ENDPOINTS: {
        CONTENT: '/api/content.php',
        UPDATE: '/api/update.php',
        STATUS: '/api/status.php'
    },
    VIDEO_CONFIG: {
        autoRestart: true,
        maxRetries: 3,
        retryDelay: 5000, // 5 seconds between retries
        defaultVolume: 1.0,
        // Hardware acceleration hints
        playbackRate: 1.0,
        hardwareAcceleration: true
    }
};
