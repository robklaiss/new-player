class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.loader = document.getElementById('loader');
        this.status = document.getElementById('status');
        this.progress = document.getElementById('progress');
        
        if (!this.video) {
            this.updateStatus('Error: Video element not found!', 'error');
            return;
        }
        
        this.playlist = [];
        this.currentIndex = 0;
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Show device ID
        this.updateProgress(`Device ID: ${API_CONFIG.DEVICE_ID}`);
        
        // Load playlist
        this.updateStatus('Conectando a Infoactive Online...');
        this.loadPlaylist();
    }
    
    updateStatus(message, type = 'info') {
        console.log(`Status: ${message}`);
        if (this.status) {
            this.status.textContent = message;
            this.status.className = type;
        }
    }
    
    updateProgress(message) {
        console.log(`Progress: ${message}`);
        if (this.progress) {
            this.progress.textContent = message;
        }
    }
    
    setupEventListeners() {
        if (!this.video) return;
        
        this.video.addEventListener('ended', () => {
            this.updateStatus('Video finalizado, recargando...');
            this.loadPlaylist();
        });
        
        this.video.addEventListener('error', (e) => {
            const error = e.target.error;
            let errorMessage = 'Error reproduciendo video';
            if (error) {
                switch (error.code) {
                    case MediaError.MEDIA_ERR_ABORTED:
                        errorMessage = 'La reproducción fue abortada';
                        break;
                    case MediaError.MEDIA_ERR_NETWORK:
                        errorMessage = 'Error de red al cargar el video';
                        break;
                    case MediaError.MEDIA_ERR_DECODE:
                        errorMessage = 'Error al decodificar el video';
                        break;
                    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                        errorMessage = 'Formato de video no soportado';
                        break;
                }
            }
            this.updateStatus(errorMessage, 'error');
            console.error('Video error:', error);
            setTimeout(() => this.loadPlaylist(), 5000);
        });
        
        this.video.addEventListener('loadstart', () => {
            this.updateStatus('Cargando video...');
            this.video.classList.remove('ready');
        });
        
        this.video.addEventListener('loadeddata', () => {
            this.updateStatus('Video cargado');
            this.video.classList.add('ready');
        });
        
        this.video.addEventListener('playing', () => {
            this.updateStatus('Reproduciendo');
            if (this.loader) {
                this.loader.style.display = 'none';
            }
        });
        
        this.video.addEventListener('progress', () => {
            if (this.video.buffered.length > 0) {
                const percent = Math.round((this.video.buffered.end(0) / this.video.duration) * 100);
                this.updateProgress(`Cargando: ${percent}%`);
            }
        });
        
        this.video.addEventListener('waiting', () => {
            this.updateStatus('Buffering...');
            if (this.loader) {
                this.loader.style.display = 'block';
            }
        });
    }
    
    async loadPlaylist() {
        try {
            this.updateStatus('Conectando a Infoactive Online...');
            console.log('Fetching from:', `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONTENT}`);
            console.log('Headers:', API_CONFIG.HEADERS);
            
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONTENT}?key=${API_CONFIG.API_KEY}`, {
                headers: API_CONFIG.HEADERS,
                timeout: 5000
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API Response:', data);
            
            if (data.content && data.content.video) {
                this.playlist = [{
                    url: data.content.video,
                    filename: data.content.video.split('/').pop()
                }];
                this.updateStatus('Video encontrado, iniciando reproducción...');
                console.log('Video URL:', data.content.video);
                this.startPlayback();
            } else {
                throw new Error('No video in response');
            }
        } catch (error) {
            const errorMessage = `Error de conexión: ${error.message}`;
            this.updateStatus(errorMessage, 'error');
            console.error('Error loading playlist:', error);
            setTimeout(() => this.loadPlaylist(), 5000);
        }
    }
    
    startPlayback() {
        if (!this.video || this.playlist.length === 0) {
            this.updateStatus('Error: No se puede iniciar la reproducción', 'error');
            return;
        }
        
        const currentVideo = this.playlist[this.currentIndex];
        this.updateStatus('Iniciando reproducción...');
        console.log('Starting playback of:', currentVideo.url);
        
        this.video.src = currentVideo.url;
        this.video.load();
        
        const playPromise = this.video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                const errorMessage = `Error iniciando reproducción: ${error.message}`;
                this.updateStatus(errorMessage, 'error');
                console.error('Error playing video:', error);
                setTimeout(() => this.loadPlaylist(), 5000);
            });
        }
    }
}

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing player');
    console.log('API Config:', API_CONFIG);
    window.player = new VideoPlayer();
});