// Service Worker for Video Player
importScripts('config.js');

const CACHE_NAME = 'video-player-cache-v1';
let currentVersion = null;

// Helper function to add API headers
function getApiHeaders() {
    return {
        'Authorization': `Bearer ${API_CONFIG.API_KEY}`,
        'X-Device-Id': API_CONFIG.DEVICE_ID,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };
}

// Helper function to handle API errors
async function handleApiError(response) {
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        
        let error;
        try {
            error = JSON.parse(errorText);
        } catch {
            error = { error: errorText || 'Unknown error' };
        }
        
        if (response.status === 401) {
            console.error('Authentication failed. Please verify API key.');
        } else if (response.status === 403) {
            console.error('Access forbidden. Please verify device ID and permissions.');
        }
        
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Cache both current and next video for smooth transitions
async function fetchManifest() {
    try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/content.php`, {
            headers: getApiHeaders()
        });
        
        const manifest = await handleApiError(response);
        currentVersion = manifest.version;
        
        // Cache the current and next videos
        const cache = await caches.open(CACHE_NAME);
        const videosToCache = [
            manifest.content.video,
            manifest.content.nextVideo
        ].filter(Boolean);  // Remove undefined/null values
        
        // Pre-cache videos with progress tracking
        await Promise.all(videosToCache.map(async videoUrl => {
            try {
                // Check if video is already cached
                const cached = await cache.match(videoUrl);
                if (!cached) {
                    console.log(`Caching video: ${videoUrl}`);
                    await cache.add(videoUrl);
                    console.log(`Successfully cached: ${videoUrl}`);
                }
            } catch (error) {
                console.error(`Error caching video ${videoUrl}:`, error);
                await reportError('video_cache_error', `Failed to cache ${videoUrl}: ${error.message}`);
            }
        }));
        
        // Notify all clients about the update
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'contentUpdate',
                content: manifest.content,
                cached: videosToCache
            });
        });
        
        return manifest;
    } catch (error) {
        console.error('Error fetching manifest:', error);
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

// Enhanced fetch handler with offline support
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(async cachedResponse => {
                if (cachedResponse) {
                    // Return cached response
                    return cachedResponse;
                }
                
                try {
                    // If not in cache, try to fetch
                    const response = await fetch(event.request);
                    
                    // Cache successful video responses
                    if (response.ok && event.request.url.match(/\.(mp4|webm|ogg)$/i)) {
                        const cache = await caches.open(CACHE_NAME);
                        cache.put(event.request, response.clone());
                    }
                    
                    return response;
                } catch (error) {
                    console.error('Fetch error:', error);
                    await reportError('fetch_error', `${error.message} for ${event.request.url}`);
                    throw error;
                }
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
