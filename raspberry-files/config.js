// API Configuration
const API_CONFIG = {
    BASE_URL: 'https://vinculo.com.py/new-player/api',
    API_KEY: '7fdc741c44f13efbe392c60b82f7509b972e32a0a2265ab1df415567bdeddbd7',
    DEVICE_ID: crypto.randomUUID(), // Generate a unique device ID
    UPDATE_INTERVAL: 60000, // Status update interval in milliseconds (1 minute)
    CONTENT_CHECK_INTERVAL: 300000 // Content check interval in milliseconds (5 minutes)
};
