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
        this.video.autoplay = true;
        
        // Add hardware acceleration and performance hints
        this.video.style.transform = 'translateZ(0)';
        this.video.style.webkitTransform = 'translateZ(0)';
        this.video.style.backfaceVisibility = 'hidden';
        this.video.style.perspective = '1000px';
        this.video.style.willChange = 'transform';
        
        // Disable right-click menu
        this.video.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Local video directory
        this.videoDir = '/var/www/kiosk/videos/';
        
        // Remote video URL (for downloading)
        this.remoteVideoUrl = 'https://vinculo.com.py/new-player/api/content.php';
        
        // Hide loader initially
        if (this.loader) this.loader.style.display = 'none';
        
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
            if (this.loader) this.loader.style.display = 'none';
        }
    }
    
    async loadVideos() {
        try {
            this.updateStatus('Verificando videos locales...');
            
            // Always check local files first
            const localFiles = await this.getLocalFiles();
            if (localFiles.length > 0) {
                console.log('Found local files:', localFiles);
                this.updatePlaylist(localFiles.map(file => ({
                    filename: file,
                    url: 'file://' + this.videoDir + file,
                    type: 'video/mp4'
                })));
                return;
            }
            
            this.updateStatus('Descargando videos nuevos...');
            if (this.loader) this.loader.style.display = 'block';
            
            // Try to fetch from remote API
            try {
                const response = await fetch(this.remoteVideoUrl, {
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Error de conexión: ' + response.status);
                }
                
                const data = await response.json();
                if (data.content && data.content.videos && data.content.videos.length > 0) {
                    const videos = Array.isArray(data.content.videos) ? data.content.videos : [data.content.videos];
                    
                    // Download videos to local storage
                    await this.downloadVideos(videos);
                    
                    // After download, use local files
                    const newLocalFiles = await this.getLocalFiles();
                    this.updatePlaylist(newLocalFiles.map(file => ({
                        filename: file,
                        url: 'file://' + this.videoDir + file,
                        type: 'video/mp4'
                    })));
                } else {
                    throw new Error('No hay videos disponibles');
                }
            } catch (error) {
                console.warn('Error al obtener videos remotos:', error);
                this.updateStatus('Error: ' + error.message);
                if (this.loader) this.loader.style.display = 'none';
                setTimeout(() => this.loadVideos(), 5000);
            }
        } catch (error) {
            console.error('Error loading videos:', error);
            this.updateStatus('Error: ' + error.message);
            if (this.loader) this.loader.style.display = 'none';
            setTimeout(() => this.loadVideos(), 5000);
        }
    }
    
    async getLocalFiles() {
        try {
            // Use fetch to call a local endpoint that lists files
            const response = await fetch('/list-videos');
            if (!response.ok) {
                throw new Error('Could not list local videos');
            }
            const files = await response.json();
            return files.filter(file => file.endsWith('.mp4'));
        } catch (error) {
            console.warn('Error listing local videos:', error);
            return [];
        }
    }
    
    async downloadVideos(videos) {
        for (const video of videos) {
            try {
                const url = video.url || (this.remoteVideoUrl + video.filename);
                const response = await fetch(url);
                if (!response.ok) throw new Error('Download failed');
                
                const blob = await response.blob();
                const filename = video.filename;
                
                // Use fetch to send the video to a local endpoint that saves it
                const formData = new FormData();
                formData.append('video', blob, filename);
                
                await fetch('/save-video', {
                    method: 'POST',
                    body: formData
                });
                
                console.log('Downloaded and saved:', filename);
            } catch (error) {
                console.error('Error downloading video:', video.filename, error);
            }
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
        
        // Hide loader only when video is actually playing
        if (this.loader) this.loader.style.display = 'none';
        
        // Set current video source and play
        this.video.src = video.url;
        
        // Force a clean reload
        this.video.load();
        
        // Try to play immediately
        const playPromise = this.video.play();
        if (playPromise) {
            playPromise.catch(error => {
                console.error('Error playing video:', error);
                // Only show error if it's not a user interaction error
                if (error.name !== 'NotAllowedError') {
                    this.updateStatus('Error al reproducir video');
                    setTimeout(() => this.playNext(), 2000);
                }
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
        // Minimize loader visibility by only showing it when actually loading
        let loadingTimeout;
        
        this.video.addEventListener('loadstart', () => {
            console.log('Video loadstart');
            // Only show loader after a small delay to avoid flashing
            loadingTimeout = setTimeout(() => {
                if (this.loader && !this.video.readyState) {
                    this.loader.style.display = 'block';
                }
            }, 500);
        });
        
        this.video.addEventListener('loadeddata', () => {
            console.log('Video data loaded');
            clearTimeout(loadingTimeout);
            if (this.loader) this.loader.style.display = 'none';
        });
        
        this.video.addEventListener('canplay', () => {
            console.log('Video can play');
            clearTimeout(loadingTimeout);
            if (this.loader) this.loader.style.display = 'none';
        });
        
        this.video.addEventListener('playing', () => {
            console.log('Video playing:', this.getCurrentVideoName());
            clearTimeout(loadingTimeout);
            if (this.loader) this.loader.style.display = 'none';
            this.updateStatus('Reproduciendo: ' + this.getCurrentVideoName());
        });
        
        this.video.addEventListener('waiting', () => {
            console.log('Video waiting');
            if (this.loader) this.loader.style.display = 'block';
        });
        
        this.video.addEventListener('error', (e) => {
            console.error('Video error:', e.target.error);
            this.updateStatus('Error en el video');
            setTimeout(() => this.playNext(), 2000);
        });
        
        this.video.addEventListener('ended', () => {
            console.log('Video ended');
            this.playNext();
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