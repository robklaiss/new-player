class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        if (!this.video) {
            console.error('Video element not found!');
            return;
        }
        console.log('Video player initialized');
        
        this.playlist = [];
        this.currentIndex = 0;
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load playlist
        this.loadPlaylist();
    }
    
    setupEventListeners() {
        if (!this.video) return;
        
        this.video.addEventListener('ended', () => {
            console.log('Video ended, reloading playlist');
            this.loadPlaylist();
        });
        
        this.video.addEventListener('error', (e) => {
            console.error('Video error:', e);
            setTimeout(() => this.loadPlaylist(), 5000);
        });
        
        this.video.addEventListener('loadstart', () => {
            console.log('Video load started');
        });
        
        this.video.addEventListener('loadeddata', () => {
            console.log('Video data loaded');
        });
        
        this.video.addEventListener('playing', () => {
            console.log('Video is playing');
        });
    }
    
    async loadPlaylist() {
        try {
            console.log('Loading playlist...');
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
                console.log('Playlist updated:', this.playlist);
                this.startPlayback();
            } else {
                console.error('No video in response:', data);
                setTimeout(() => this.loadPlaylist(), 5000);
            }
        } catch (error) {
            console.error('Error loading playlist:', error);
            setTimeout(() => this.loadPlaylist(), 5000);
        }
    }
    
    startPlayback() {
        if (!this.video || this.playlist.length === 0) {
            console.error('Cannot start playback - video element or playlist missing');
            return;
        }
        
        const currentVideo = this.playlist[this.currentIndex];
        console.log('Starting playback of:', currentVideo);
        
        this.video.src = currentVideo.url;
        this.video.load();
        
        const playPromise = this.video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
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