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
        this.video.addEventListener('playing', () => {
            this.updateStatus('Video reproduciendo');
            if (this.loader) this.loader.style.display = 'none';
        });
        
        this.video.addEventListener('waiting', () => {
            this.updateStatus('Cargando video...');
            if (this.loader) this.loader.style.display = 'block';
        });
        
        this.video.addEventListener('error', (e) => {
            this.updateStatus('Error al cargar video');
            console.error('Video error:', e.target.error);
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