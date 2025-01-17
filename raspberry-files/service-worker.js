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
    const manifestResponse = await fetch(MANIFEST_URL);
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

    // Check individual file versions
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
  const cache = await caches.open(CACHE_NAME);
  await cache.keys().then(keys => {
    keys.forEach(request => {
      cache.delete(request);
    });
  });
  return cache.addAll(urlsToCache);
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    (async () => {
      // Check manifest for updates periodically (only for navigation requests)
      if (event.request.mode === 'navigate') {
        const needsUpdate = await checkForUpdates();
        if (needsUpdate) {
          await updateCache();
        }
      }

      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) {
        return cachedResponse;
      }

      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          await cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        console.error('Fetch failed:', error);
        return new Response('Network error', { status: 500 });
      }
    })()
  );
});

// Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
