const CACHE_NAME = 'video-player-cache-v1';
const MANIFEST_URL = '/update.json';
let manifestData = null;

const urlsToCache = [
  '/',
  '/index.html',
  '/video.mp4',
  '/update.json'
];

// Function to check if content needs updating
async function checkForUpdates() {
  try {
    const manifestResponse = await fetch(MANIFEST_URL, {
      cache: 'no-store',  // Always get fresh manifest
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!manifestResponse.ok) {
      throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`);
    }

    const newManifest = await manifestResponse.json();

    if (!manifestData) {
      manifestData = newManifest;
      return false;
    }

    // Check if version has changed
    if (newManifest.version !== manifestData.version) {
      console.log('New version detected:', newManifest.version);
      manifestData = newManifest;
      return true;
    }

    // Check individual file versions and hashes
    for (const [file, info] of Object.entries(newManifest.files)) {
      if (!manifestData.files[file] || 
          manifestData.files[file].version !== info.version ||
          manifestData.files[file].hash !== info.hash) {
        console.log('File update detected:', file);
        manifestData = newManifest;
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking manifest:', error);
    return false;
  }
}

// Function to clear and repopulate cache
async function updateCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    
    // Clear existing cache
    const keys = await cache.keys();
    await Promise.all(keys.map(key => cache.delete(key)));
    
    // Cache new files
    const filesToCache = Object.keys(manifestData.files).map(file => '/' + file);
    filesToCache.push('/');
    filesToCache.push('/index.html');
    filesToCache.push('/update.json');
    
    console.log('Caching files:', filesToCache);
    await cache.addAll(filesToCache);
    
    return true;
  } catch (error) {
    console.error('Error updating cache:', error);
    return false;
  }
}

// Check for updates periodically
setInterval(async () => {
  const needsUpdate = await checkForUpdates();
  if (needsUpdate) {
    console.log('Update needed, refreshing cache...');
    await updateCache();
    // Notify clients of update
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'UPDATE_AVAILABLE' });
    });
  }
}, 60000); // Check every minute

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          response => {
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        );
      })
      .catch(error => {
        console.error('Fetch error:', error);
        // Return a fallback response or error page
        return new Response('Network error', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
