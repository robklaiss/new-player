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
        
        // Add video event listeners
        this.setupEventListeners();
        
        // Start loading videos
        console.log('Starting video player...');
        this.loadVideos();
        
        // Check for new videos every minute
        setInterval(() => this.loadVideos(), 60000);
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
    
    updateStatus(message) {
        console.log('Status:', message);
        if (this.status) {
            this.status.textContent = message;
        }
    }
    
    async loadVideos() {
        try {
            this.updateStatus('Buscando videos...');
            console.log('Looking for local videos...');
            
            // Try to load local video list first
            try {
                const localVideoList = await this.getLocalVideos();
                if (localVideoList && localVideoList.length > 0) {
                    this.updatePlaylist(localVideoList);
                    return;
                }
            } catch (error) {
                console.warn('Error loading local videos:', error);
            }
            
            // Fallback to server if local fails
            const response = await fetch(this.remoteVideoUrl + 'videos.json');
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            
            const data = await response.json();
            if (data.videos && data.videos.length > 0) {
                // Download videos that don't exist locally
                for (const video of data.videos) {
                    const localPath = this.videoDir + video.filename;
                    if (!this.fileExists(localPath)) {
                        await this.downloadVideo(video.filename);
                    }
                }
                this.updatePlaylist(data.videos);
            } else {
                throw new Error('No hay videos disponibles');
            }
        } catch (error) {
            console.error('Error loading videos:', error);
            this.updateStatus('Error: ' + error.message);
            setTimeout(() => this.loadVideos(), 5000);
        }
    }
    
    async getLocalVideos() {
        return new Promise((resolve) => {
            const videos = [];
            // Use local video directory
            const videoFiles = this.getDirectoryFiles(this.videoDir, '.mp4');
            
            for (const filename of videoFiles) {
                const filepath = this.videoDir + filename;
                videos.push({
                    filename: filename,
                    localUrl: 'file://' + filepath,
                    type: 'video/mp4'
                });
            }
            
            resolve(videos);
        });
    }
    
    getDirectoryFiles(directory, extension) {
        // This is a placeholder - in a real implementation you would
        // need to use Node.js fs module or a similar mechanism to read directory
        // For now, we'll return an empty array and rely on the server list
        return [];
    }
    
    updatePlaylist(videos) {
        // Clean up old videos
        for (const [filename, url] of this.localVideos.entries()) {
            const videoExists = videos.some(v => v.filename === filename);
            if (!videoExists) {
                console.log('Removing deleted video:', filename);
                URL.revokeObjectURL(url);
                this.localVideos.delete(filename);
            }
        }
        
        // Update playlist with local paths
        this.playlist = videos.map(video => ({
            ...video,
            localUrl: 'file://' + this.videoDir + video.filename
        }));
        
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
        
        if (!video || !video.localUrl) {
            console.error('Invalid video or missing localUrl:', video);
            setTimeout(() => this.playNext(), 1000);
            return;
        }
        
        console.log('Playing next video:', video.filename, 'index:', this.currentIndex);
        
        // Pre-load the next video aggressively
        const nextIndex = (this.currentIndex + 1) % this.playlist.length;
        const nextVideo = this.playlist[nextIndex];
        if (nextVideo && nextVideo.localUrl) {
            const preloadVideo = document.createElement('video');
            preloadVideo.preload = 'auto';
            preloadVideo.src = nextVideo.localUrl;
            
            // Force load metadata
            preloadVideo.addEventListener('loadedmetadata', () => {
                console.log('Preloaded next video:', nextVideo.filename);
            });
            
            preloadVideo.load();
            
            // Keep preloading for a longer time
            setTimeout(() => preloadVideo.remove(), 10000);
        }
        
        // Set current video source and force load
        this.video.src = video.localUrl;
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
    
    fileExists(path) {
        // This is a placeholder - in a real implementation you would
        // need to use Node.js fs module or a similar mechanism to check file existence
        // For now, we'll assume the file does not exist
        return false;
    }
    
    async downloadVideo(filename) {
        // This is a placeholder - in a real implementation you would
        // need to use Node.js fs module or a similar mechanism to download the file
        // For now, we'll just log a message
        console.log('Downloading video:', filename);
    }
}

// Start player when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting player...');
    new VideoPlayer();
});