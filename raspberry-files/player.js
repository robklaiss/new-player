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
        
        // Load playlist
        this.updateStatus('Conectando a Infoactive Online...');
        this.loadPlaylist();
    }
    
    updateStatus(message, type = 'info') {
        console.log(message);
        if (this.status) {
            this.status.textContent = message;
            this.status.className = type;
        }
    }
    
    updateProgress(message) {
        console.log(message);
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
            this.updateStatus('Error reproduciendo video', 'error');
            console.error('Video error:', e);
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
                this.startPlayback();
            } else {
                throw new Error('No video in response');
            }
        } catch (error) {
            this.updateStatus('Error de conexión, reintentando...', 'error');
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
        
        this.video.src = currentVideo.url;
        this.video.load();
        
        const playPromise = this.video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                this.updateStatus('Error iniciando reproducción', 'error');
                console.error('Error playing video:', error);
                setTimeout(() => this.loadPlaylist(), 5000);
            });
        }
    }
}

// Initialize player when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing player');
    window.player = new VideoPlayer();
});