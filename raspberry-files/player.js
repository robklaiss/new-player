class VideoPlayer {
    constructor() {
        this.videoElement = document.getElementById('videoPlayer');
        this.playlist = [];
        this.currentIndex = 0;
        this.retryCount = 0;
        
        // Set up event listeners
        this.videoElement.addEventListener('ended', () => this.playNext());
        this.videoElement.addEventListener('error', () => this.handleError());
        
        // Start the player
        this.init();
    }
    
    async init() {
        await this.loadPlaylist();
        this.startPlayback();
        
        // Set up periodic playlist refresh
        setInterval(() => this.loadPlaylist(), API_CONFIG.CONTENT_CHECK_INTERVAL);
    }
    
    async loadPlaylist() {
        try {
            const response = await fetch(API_CONFIG.BASE_URL + '/admin/videos.php');
            const data = await response.json();
            
            if (data.success && data.videos) {
                this.playlist = data.videos.map(video => ({
                    url: API_CONFIG.BASE_URL + video.url,
                    filename: video.filename
                }));
                
                console.log('Playlist updated:', this.playlist);
            }
        } catch (error) {
            console.error('Error loading playlist:', error);
        }
    }
    
    startPlayback() {
        if (this.playlist.length > 0) {
            this.playVideo(this.playlist[this.currentIndex]);
        }
    }
    
    playVideo(video) {
        console.log('Playing:', video.filename);
        this.videoElement.src = video.url;
        this.videoElement.play()
            .catch(error => console.error('Playback error:', error));
    }
    
    playNext() {
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        this.retryCount = 0;
        this.startPlayback();
    }
    
    handleError() {
        console.error('Video error:', this.videoElement.error);
        
        if (this.retryCount < API_CONFIG.VIDEO_CONFIG.maxRetries) {
            this.retryCount++;
            setTimeout(() => this.startPlayback(), API_CONFIG.VIDEO_CONFIG.retryDelay);
        } else {
            this.playNext();
        }
    }
}

// Start the player when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new VideoPlayer();
});