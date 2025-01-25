class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        this.loader = document.getElementById('loader');
        this.playlist = [];
        this.currentIndex = 0;
        this.localVideos = new Map(); // Store downloaded videos
        
        if (!this.video) {
            console.error('Video element not found');
            return;
        }
        
        // Set up video
        this.video.loop = false; // Don't loop individual videos
        this.video.muted = true;
        this.video.playsInline = true;
        
        // Add video event listeners
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
            console.log('Video playing');
            this.updateStatus('Video reproduciendo: ' + this.getCurrentVideoName());
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
                    case MediaError.MEDIA_ERR_ABORTED:
                        errorMsg = 'Carga abortada';
                        break;
                    case MediaError.MEDIA_ERR_NETWORK:
                        errorMsg = 'Error de red';
                        break;
                    case MediaError.MEDIA_ERR_DECODE:
                        errorMsg = 'Error de decodificación';
                        break;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMsg = 'Formato no soportado';
                        break;
                }
            }
            this.updateStatus('Error: ' + errorMsg);
            console.error('Video error:', error, errorMsg);
            setTimeout(() => this.playNext(), 5000); // Try next video on error
        });
        
        // Start loading videos
        this.loadVideos();
        
        // Check for new videos every minute
        setInterval(() => this.loadVideos(), 60000);
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
            const response = await fetch(video.url);
            const blob = await response.blob();
            const localUrl = URL.createObjectURL(blob);
            this.localVideos.set(video.filename, localUrl);
            console.log('Downloaded:', video.filename);
            return localUrl;
        } catch (error) {
            console.error('Error downloading video:', error);
            return null;
        }
    }
    
    async loadVideos() {
        try {
            this.updateStatus('Buscando videos...');
            const response = await fetch('https://vinculo.com.py/new-player/api/content.php');
            const data = await response.json();
            
            if (data.content && data.content.videos) {
                // Download any new videos
                for (const video of data.content.videos) {
                    if (!this.localVideos.has(video.filename)) {
                        await this.downloadVideo(video);
                    }
                }
                
                // Update playlist with local URLs
                this.playlist = data.content.videos.map(video => ({
                    ...video,
                    localUrl: this.localVideos.get(video.filename)
                })).filter(video => video.localUrl); // Only keep videos that were downloaded successfully
                
                // Start playback if not already playing
                if (!this.video.src) {
                    this.playNext();
                }
            } else {
                throw new Error('No videos in response');
            }
        } catch (error) {
            console.error('Error loading videos:', error);
            this.updateStatus('Error de conexión');
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
        
        console.log('Playing next video:', video.filename);
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
    new VideoPlayer();
});