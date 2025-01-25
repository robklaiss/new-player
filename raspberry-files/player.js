class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        this.loader = document.getElementById('loader');
        this.playlist = [];
        this.currentIndex = -1;
        this.localVideos = new Map();
        
        if (!this.video) {
            console.error('Video element not found');
            return;
        }
        
        // Set up video with optimized settings
        this.video.loop = false;
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.preload = 'auto';
        
        // Add hardware acceleration hint
        this.video.style.transform = 'translateZ(0)';
        
        // Local video directory
        this.videoDir = '/var/www/kiosk/videos/';
        
        // Remote video URL (for downloading)
        this.remoteVideoUrl = 'https://vinculo.com.py/new-player/videos/';
        
        // Set up service worker message handling
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
        }
        
        // Add video event listeners
        this.setupEventListeners();
        
        // Start loading videos
        console.log('Starting video player...');
        this.loadVideos();
        
        // Check for new videos every minute
        setInterval(() => this.loadVideos(), 60000);
    }
    
    handleServiceWorkerMessage(event) {
        if (event.data.type === 'VIDEOS_CACHED') {
            console.log('Videos cached successfully');
            this.updateStatus('Videos guardados para reproducción sin conexión');
        }
    }
    
    async loadVideos() {
        try {
            this.updateStatus('Buscando videos...');
            
            // Try to load local video list first
            const localVideoList = await this.getLocalVideos();
            if (localVideoList && localVideoList.length > 0) {
                this.updatePlaylist(localVideoList);
                return;
            }
            
            // Try to fetch from remote
            try {
                const response = await fetch(this.remoteVideoUrl + 'videos.json');
                if (!response.ok) {
                    throw new Error('HTTP error! status: ' + response.status);
                }
                
                const data = await response.json();
                if (data.videos && data.videos.length > 0) {
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        navigator.serviceWorker.controller.postMessage({
                            type: 'CACHE_VIDEOS',
                            videos: data.videos.map(video => ({
                                url: this.remoteVideoUrl + video.filename,
                                filename: video.filename
                            }))
                        });
                    }
                    this.updatePlaylist(data.videos);
                }
            } catch (error) {
                console.warn('Failed to fetch remote videos:', error);
                // If remote fetch fails, try to use local files directly
                const filename = 'verano-pile-opt-ok.mp4';
                const localPath = this.videoDir + filename;
                this.updatePlaylist([{
                    filename: filename,
                    url: 'file://' + localPath,
                    type: 'video/mp4'
                }]);
            }
        } catch (error) {
            console.error('Error loading videos:', error);
            this.updateStatus('Error: ' + error.message);
            setTimeout(() => this.loadVideos(), 5000);
        }
    }
    
    async getLocalVideos() {
        try {
            const cache = await caches.open('video-cache-v1');
            const keys = await cache.keys();
            const videos = [];
            
            for (const request of keys) {
                if (request.url.endsWith('.mp4')) {
                    const filename = request.url.split('/').pop();
                    videos.push({
                        filename: filename,
                        url: request.url,
                        type: 'video/mp4'
                    });
                }
            }
            
            return videos;
        } catch (error) {
            console.warn('Error getting cached videos:', error);
            return [];
        }
    }
    
    updatePlaylist(videos) {
        this.playlist = videos;
        console.log('Playlist updated:', this.playlist.length, 'videos');
        
        if (this.playlist.length === 0) {
            throw new Error('No se pudieron encontrar videos');
        }
        
        // Start playback if needed
        if (!this.video.src || this.video.error || !this.video.currentTime) {
            this.playNext();
        }
    }
    
    playNext() {
        if (this.playlist.length === 0) {
            this.updateStatus('No hay videos disponibles');
            return;
        }
        
        // Move to next video, loop back to start if at end
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        const video = this.playlist[this.currentIndex];
        
        if (!video || !video.url) {
            console.error('Invalid video or missing URL:', video);
            setTimeout(() => this.playNext(), 1000);
            return;
        }
        
        console.log('Playing next video:', video.filename, 'index:', this.currentIndex);
        
        // Pre-load the next video aggressively
        const nextIndex = (this.currentIndex + 1) % this.playlist.length;
        const nextVideo = this.playlist[nextIndex];
        if (nextVideo && nextVideo.url) {
            const preloadVideo = document.createElement('video');
            preloadVideo.preload = 'auto';
            preloadVideo.src = nextVideo.url;
            
            preloadVideo.addEventListener('loadedmetadata', () => {
                console.log('Preloaded next video:', nextVideo.filename);
            });
            
            preloadVideo.load();
            setTimeout(() => preloadVideo.remove(), 10000);
        }
        
        // Set current video source and force load
        this.video.src = video.url;
        this.video.load();
        
        const playPromise = this.video.play();
        if (playPromise) {
            playPromise.catch(error => {
                console.error('Error playing video:', error);
                this.updateStatus('Error al reproducir video');
                setTimeout(() => this.playNext(), 5000);
            });
        }
    }
    
    updateStatus(message) {
        console.log('Status:', message);
        if (this.status) {
            this.status.textContent = message;
        }
    }
    
    setupEventListeners() {
        this.video.addEventListener('loadstart', () => {
            console.log('Video loadstart');
            this.updateStatus('Iniciando carga...');
            this.video.classList.remove('ready');
        });
        
        this.video.addEventListener('loadeddata', () => {
            console.log('Video loadeddata');
            this.updateStatus('Video listo');
            this.video.classList.add('ready');
        });
        
        this.video.addEventListener('playing', () => {
            console.log('Video playing:', this.getCurrentVideoName());
            this.updateStatus('Reproduciendo: ' + this.getCurrentVideoName());
            this.video.classList.add('ready');
            if (this.loader) this.loader.style.display = 'none';
        });
        
        this.video.addEventListener('ended', () => {
            console.log('Video ended, playing next');
            this.playNext();
        });
        
        this.video.addEventListener('waiting', () => {
            console.log('Video waiting');
            this.updateStatus('Cargando video...');
            if (this.loader) this.loader.style.display = 'block';
        });
        
        this.video.addEventListener('error', (e) => {
            const error = e.target.error;
            let errorMsg = 'Error desconocido';
            if (error) {
                switch (error.code) {
                    case MediaError.MEDIA_ERR_ABORTED: errorMsg = 'Carga abortada'; break;
                    case MediaError.MEDIA_ERR_NETWORK: errorMsg = 'Error de red'; break;
                    case MediaError.MEDIA_ERR_DECODE: errorMsg = 'Error de decodificación'; break;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: errorMsg = 'Formato no soportado'; break;
                }
            }
            console.error('Video error:', error, errorMsg);
            this.updateStatus('Error: ' + errorMsg);
            setTimeout(() => this.playNext(), 5000);
        });
    }
    
    getCurrentVideoName() {
        if (this.playlist[this.currentIndex]) {
            return this.playlist[this.currentIndex].filename;
        }
        return 'unknown';
    }
}

// Start player when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting player...');
    new VideoPlayer();
});