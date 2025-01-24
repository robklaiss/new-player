class VideoPlayer {
    constructor() {
        this.videoElement = document.getElementById('videoPlayer');
        this.playlist = [];
        this.currentIndex = 0;
        this.retryCount = 0;
        
        // Set up event listeners
        this.videoElement.addEventListener('ended', () => this.playNext());
        this.videoElement.addEventListener('error', (e) => this.handleError(e));
        
        // Start the player
        this.init();
    }
    
    async init() {
        // Start with local sample video
        this.playlist = [{
            url: 'sample.mp4',
            filename: 'sample.mp4'
        }];
        
        this.startPlayback();
        
        // Try to load remote playlist after starting local playback
        await this.loadPlaylist();
        
        // Set up periodic playlist refresh
        setInterval(() => this.loadPlaylist(), API_CONFIG.CONTENT_CHECK_INTERVAL);
    }
    
    async loadPlaylist() {
        try {
            const response = await fetch(API_CONFIG.BASE_URL + '/api/content.php', {
                headers: API_CONFIG.HEADERS
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.videos && data.videos.length > 0) {
                this.playlist = data.videos.map(video => ({
                    url: API_CONFIG.BASE_URL + video.url,
                    filename: video.filename
                }));
                
                console.log('Remote playlist updated:', this.playlist);
            } else {
                console.log('Using local sample video');
            }
        } catch (error) {
            console.error('Error loading playlist:', error);
            // Keep using local sample video on error
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
            .catch(error => {
                console.error('Error playing video:', error);
                this.handleError(error);
            });
    }
    
    handleError(error) {
        console.error('Video error:', error);
        
        if (this.retryCount < API_CONFIG.VIDEO_CONFIG.maxRetries) {
            this.retryCount++;
            console.log(`Retrying playback (${this.retryCount}/${API_CONFIG.VIDEO_CONFIG.maxRetries})...`);
            setTimeout(() => this.playVideo(this.playlist[this.currentIndex]), API_CONFIG.VIDEO_CONFIG.retryDelay);
        } else {
            this.retryCount = 0;
            this.playNext();
        }
    }
    
    playNext() {
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        this.playVideo(this.playlist[this.currentIndex]);
    }
}

// Start the player when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new VideoPlayer();
});