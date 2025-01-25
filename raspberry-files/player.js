class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        this.loader = document.getElementById('loader');
        
        if (!this.video) {
            console.error('Video element not found');
            return;
        }
        
        // Set up video
        this.video.loop = true;
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
            this.updateStatus('Video reproduciendo');
            this.video.classList.add('ready');
            if (this.loader) this.loader.style.display = 'none';
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
        });
        
        // Load and play video
        this.loadVideo();
        
        // Check for new video every minute
        setInterval(() => this.loadVideo(), 60000);
    }
    
    updateStatus(message) {
        console.log('Status:', message);
        if (this.status) {
            this.status.textContent = message;
        }
    }
    
    async loadVideo() {
        try {
            this.updateStatus('Conectando a Infoactive Online...');
            const response = await fetch('https://vinculo.com.py/new-player/api/content.php');
            const data = await response.json();
            
            if (data.content && data.content.video) {
                if (this.video.src !== data.content.video) {
                    console.log('Loading new video:', data.content.video);
                    this.video.src = data.content.video;
                    this.video.load();
                    const playPromise = this.video.play();
                    if (playPromise) {
                        playPromise.catch(error => {
                            console.error('Error playing video:', error);
                            this.updateStatus('Error al reproducir video');
                            // Retry after 5 seconds
                            setTimeout(() => this.loadVideo(), 5000);
                        });
                    }
                }
            } else {
                throw new Error('No video URL in response');
            }
        } catch (error) {
            console.error('Error loading video:', error);
            this.updateStatus('Error de conexión');
            // Retry after 5 seconds on error
            setTimeout(() => this.loadVideo(), 5000);
        }
    }
}

// Start player when page loads
document.addEventListener('DOMContentLoaded', () => {
    new VideoPlayer();
});