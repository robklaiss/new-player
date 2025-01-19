// Service Worker for Video Player
importScripts('config.js');

const CACHE_NAME = 'video-player-cache-v1';
let currentVersion = null;

// Helper function to add API headers
function getApiHeaders() {
    return {
        'X-API-Key': API_CONFIG.API_KEY,
        'X-Device-Id': API_CONFIG.DEVICE_ID
    };
}

// Helper function to handle API errors
async function handleApiError(response) {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Fetch and cache the manifest
async function fetchManifest() {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/content.php`, {
            headers: getApiHeaders()
        });
        
        const manifest = await handleApiError(response);
        currentVersion = manifest.version;
        
        // Cache the video URL
        const cache = await caches.open(CACHE_NAME);
        await cache.add(manifest.content.video);
        
        // Notify all clients about the update
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'contentUpdate',
                content: manifest.content
            });
        });
        
        return manifest;
    } catch (error) {
        console.error('Error fetching manifest:', error);
        // Report error to server
        await reportError('manifest_fetch_error', error.message);
        throw error;
    }
}

// Report errors to the server
async function reportError(type, message) {
    try {
        await fetch(`${API_CONFIG.BASE_URL}/update.php`, {
            method: 'POST',
            headers: {
                ...getApiHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: 'error',
                errors: [{
                    type: type,
                    message: message,
                    timestamp: new Date().toISOString()
                }]
            })
        });
    } catch (error) {
        console.error('Error reporting to server:', error);
    }
}

// Update device status
async function updateStatus(status, currentVideo = null) {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/update.php`, {
            method: 'POST',
            headers: {
                ...getApiHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: status,
                version: currentVersion,
                current_video: currentVideo
            })
        });
        
        const result = await handleApiError(response);
        
        // Handle any commands from the server
        if (result.commands && result.commands.length > 0) {
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'commands',
                    commands: result.commands
                });
            });
        }
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// Service Worker Install
self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            self.skipWaiting(),
            fetchManifest()
        ])
    );
});

// Service Worker Activate
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            clients.claim(),
            // Clean up old caches
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

// Handle fetch requests
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
            .catch(error => {
                console.error('Fetch error:', error);
                reportError('fetch_error', error.message);
            })
    );
});

// Handle messages from clients
self.addEventListener('message', event => {
    if (event.data.type === 'checkContent') {
        event.waitUntil(fetchManifest());
    } else if (event.data.type === 'updateStatus') {
        event.waitUntil(updateStatus(event.data.status, event.data.currentVideo));
    }
});

// Set up periodic content checks
setInterval(() => {
    fetchManifest().catch(console.error);
}, API_CONFIG.CONTENT_CHECK_INTERVAL);

// Set up periodic status updates
setInterval(() => {
    updateStatus('running').catch(console.error);
}, API_CONFIG.UPDATE_INTERVAL);
