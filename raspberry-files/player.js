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
        
        // Set up video
        this.video.loop = false;
        this.video.muted = true;
        this.video.playsInline = true;
        
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
    
    async downloadVideo(video) {
        try {
            this.updateStatus('Descargando: ' + video.filename);
            console.log('Downloading:', video.url);
            
            const response = await fetch(video.url);
            console.log('Response status:', response.status);
            console.log('Response headers:', [...response.headers.entries()]);
            
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            
            const blob = await response.blob();
            console.log('Blob type:', blob.type);
            console.log('Blob size:', blob.size);
            
            if (blob.size === 0) {
                throw new Error('Downloaded file is empty');
            }
            
            console.log('Download complete:', video.filename, 'size:', blob.size);
            
            const localUrl = URL.createObjectURL(blob);
            console.log('Created local URL:', localUrl);
            
            // Test if the video is playable
            const testVideo = document.createElement('video');
            const canPlay = await new Promise((resolve) => {
                testVideo.onloadedmetadata = () => resolve(true);
                testVideo.onerror = () => resolve(false);
                testVideo.src = localUrl;
            });
            
            if (!canPlay) {
                throw new Error('Video file is not playable');
            }
            
            this.localVideos.set(video.filename, localUrl);
            return localUrl;
        } catch (error) {
            console.error('Error downloading video:', video.filename, error);
            return null;
        }
    }
    
    async loadVideos() {
        try {
            this.updateStatus('Buscando videos...');
            console.log('Fetching video list...');
            
            const response = await fetch('https://vinculo.com.py/new-player/api/content.php');
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            
            const data = await response.json();
            console.log('API response:', data);
            
            if (data.content && data.content.videos && data.content.videos.length > 0) {
                // Download any new videos
                let downloadedAny = false;
                for (const video of data.content.videos) {
                    if (!this.localVideos.has(video.filename)) {
                        const localUrl = await this.downloadVideo(video);
                        if (localUrl) {
                            downloadedAny = true;
                        }
                    }
                }
                
                // Update playlist with local URLs
                this.playlist = data.content.videos
                    .map(video => ({
                        ...video,
                        localUrl: this.localVideos.get(video.filename)
                    }))
                    .filter(video => video.localUrl);
                
                console.log('Playlist updated:', this.playlist.length, 'videos');
                
                if (this.playlist.length === 0) {
                    throw new Error('No se pudieron descargar los videos');
                }
                
                // Start playback if not already playing
                if (!this.video.src || this.video.error || downloadedAny) {
                    this.playNext();
                }
            } else {
                throw new Error('No hay videos disponibles');
            }
        } catch (error) {
            console.error('Error loading videos:', error);
            this.updateStatus('Error: ' + error.message);
            setTimeout(() => this.loadVideos(), 5000);
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
        
        console.log('Playing next video:', video.filename, 'index:', this.currentIndex);
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
}

// Start player when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting player...');
    new VideoPlayer();
});