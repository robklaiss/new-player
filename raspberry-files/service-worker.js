// Service Worker for Video Player
importScripts('config.js');

const CACHE_NAME = 'kiosk-cache-v1';
const VIDEO_CACHE = 'video-cache-v1';

// Files to cache for the app shell
const APP_SHELL_FILES = [
    '/',
    '/index.html',
    '/player.js',
    '/config.js',
    '/manifest.json',
    '/icon-192x192.png',
    '/icon-512x512.png'
];

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
        const currentVersion = manifest.version;
        
        // Cache the current and next videos
        const cache = await caches.open(VIDEO_CACHE);
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

// Helper function to download and cache a video
async function cacheVideo(videoUrl) {
    try {
        const cache = await caches.open(VIDEO_CACHE);
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        await cache.put(videoUrl, response);
        console.log('Video cached successfully:', videoUrl);
        return true;
    } catch (error) {
        console.error('Error caching video:', error);
        return false;
    }
}

// Install event - cache app shell
self.addEventListener('install', event => {
    console.log('Service Worker installing');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching app shell');
                return cache.addAll(APP_SHELL_FILES);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== VIDEO_CACHE) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Handle fetch events
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Handle video files
    if (url.pathname.endsWith('.mp4')) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // Return cached video if available
                    if (response) {
                        console.log('Serving cached video:', url.pathname);
                        return response;
                    }
                    
                    // Otherwise fetch and cache
                    console.log('Fetching video:', url.pathname);
                    return fetch(event.request)
                        .then(response => {
                            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                            
                            // Clone the response before caching
                            const responseToCache = response.clone();
                            caches.open(VIDEO_CACHE)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                            
                            return response;
                        });
                })
                .catch(error => {
                    console.error('Fetch failed:', error);
                    return new Response('Video not available offline', { status: 404 });
                })
        );
        return;
    }
    
    // Handle other requests
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Listen for messages from the client
self.addEventListener('message', event => {
    if (event.data.type === 'CACHE_VIDEOS') {
        event.waitUntil(
            Promise.all(event.data.videos.map(video => cacheVideo(video.url)))
                .then(() => {
                    // Notify client that videos are cached
                    self.clients.matchAll().then(clients => {
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'VIDEOS_CACHED',
                                success: true
                            });
                        });
                    });
                })
        );
    } else if (event.data.type === 'checkContent') {
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
