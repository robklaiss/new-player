class VideoPlayer {
    constructor() {
        this.videoElement = document.getElementById('videoPlayer');
        this.playlist = [];
        this.currentIndex = 0;
        this.retryCount = 0;
        
        // Apply video configuration
        this.configureVideo();
        
        // Set up event listeners
        this.videoElement.addEventListener('ended', () => this.playNext());
        this.videoElement.addEventListener('error', (e) => this.handleError(e));
        this.videoElement.addEventListener('loadeddata', () => this.onVideoLoaded());
        this.videoElement.addEventListener('waiting', () => this.onVideoWaiting());
        this.videoElement.addEventListener('playing', () => this.onVideoPlaying());
        
        // Start the player
        this.init();
    }
    
    configureVideo() {
        // Apply video settings from config
        this.videoElement.defaultPlaybackRate = API_CONFIG.VIDEO_CONFIG.playbackRate;
        this.videoElement.playbackRate = API_CONFIG.VIDEO_CONFIG.playbackRate;
        this.videoElement.volume = API_CONFIG.VIDEO_CONFIG.defaultVolume;
        this.videoElement.muted = API_CONFIG.VIDEO_CONFIG.muted;
        this.videoElement.preload = API_CONFIG.VIDEO_CONFIG.preload;
        this.videoElement.loop = API_CONFIG.VIDEO_CONFIG.loop;
        this.videoElement.playsInline = API_CONFIG.VIDEO_CONFIG.playsInline;
        
        // Add hardware acceleration hints
        this.videoElement.style.transform = 'translateZ(0)';
        this.videoElement.style.backfaceVisibility = 'hidden';
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
                headers: API_CONFIG.HEADERS,
                timeout: 5000 // 5 second timeout
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
            console.warn('Error loading playlist:', error);
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
        
        // Reset video element
        this.videoElement.pause();
        this.videoElement.currentTime = 0;
        this.videoElement.src = video.url;
        
        // Start loading the video
        this.videoElement.load();
        
        // Attempt to play
        this.videoElement.play()
            .catch(error => {
                console.error('Error playing video:', error);
                this.handleError(error);
            });
    }
    
    onVideoLoaded() {
        console.log('Video loaded successfully');
        this.retryCount = 0; // Reset retry count on successful load
    }
    
    onVideoWaiting() {
        console.log('Video buffering...');
    }
    
    onVideoPlaying() {
        console.log('Video playing');
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