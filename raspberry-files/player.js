class VideoPlayer {
    constructor() {
        this.videoElement = document.getElementById('videoPlayer');
        this.playlist = [];
        this.currentIndex = 0;
        this.retryCount = 0;
        this.isBuffering = false;
        
        // Apply video configuration
        this.configureVideo();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start the player
        this.init();
    }
    
    setupEventListeners() {
        this.videoElement.addEventListener('ended', () => this.playNext());
        this.videoElement.addEventListener('error', (e) => this.handleError(e));
        this.videoElement.addEventListener('loadeddata', () => this.onVideoLoaded());
        this.videoElement.addEventListener('waiting', () => this.onVideoWaiting());
        this.videoElement.addEventListener('playing', () => this.onVideoPlaying());
        this.videoElement.addEventListener('progress', () => this.onVideoProgress());
        this.videoElement.addEventListener('timeupdate', () => this.onTimeUpdate());
        
        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.videoElement.pause();
            } else {
                this.videoElement.play().catch(() => {});
            }
        });
    }
    
    configureVideo() {
        // Basic configuration
        this.videoElement.defaultPlaybackRate = API_CONFIG.VIDEO_CONFIG.playbackRate;
        this.videoElement.playbackRate = API_CONFIG.VIDEO_CONFIG.playbackRate;
        this.videoElement.volume = API_CONFIG.VIDEO_CONFIG.defaultVolume;
        this.videoElement.muted = API_CONFIG.VIDEO_CONFIG.muted;
        this.videoElement.preload = API_CONFIG.VIDEO_CONFIG.preload;
        this.videoElement.loop = API_CONFIG.VIDEO_CONFIG.loop;
        this.videoElement.playsInline = API_CONFIG.VIDEO_CONFIG.playsInline;
        
        // Performance optimizations
        this.videoElement.style.transform = 'translateZ(0)';
        this.videoElement.style.backfaceVisibility = 'hidden';
        this.videoElement.style.willChange = 'transform';
        
        // Set buffer size
        if ('buffered' in this.videoElement) {
            this.videoElement.preload = 'auto';
        }
        
        // Force hardware acceleration
        if (API_CONFIG.VIDEO_CONFIG.forceHardwareAcceleration) {
            this.videoElement.style.webkitTransform = 'translate3d(0,0,0)';
            this.videoElement.style.transform = 'translate3d(0,0,0)';
        }
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
            const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.CONTENT}?key=${API_CONFIG.API_KEY}`, {
                headers: API_CONFIG.HEADERS,
                timeout: 5000
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Response received:', data);
            
            if (data.content && data.content.video) {
                this.playlist = [{
                    url: data.content.video,
                    filename: data.content.video.split('/').pop()
                }];
                console.log('Remote playlist updated:', this.playlist);
            } else {
                console.log('No video in response:', data);
            }
        } catch (error) {
            console.warn('Error loading playlist:', error);
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
        
        // Clear source and load new video
        this.videoElement.removeAttribute('src');
        this.videoElement.load();
        this.videoElement.src = video.url;
        
        // Start loading the video
        this.videoElement.load();
        
        // Attempt to play
        const playPromise = this.videoElement.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('Error playing video:', error);
                this.handleError(error);
            });
        }
    }
    
    onVideoLoaded() {
        console.log('Video loaded successfully');
        this.retryCount = 0;
        this.isBuffering = false;
    }
    
    onVideoWaiting() {
        console.log('Video buffering...');
        this.isBuffering = true;
    }
    
    onVideoPlaying() {
        console.log('Video playing');
        this.isBuffering = false;
    }
    
    onVideoProgress() {
        if (this.videoElement.buffered.length > 0) {
            const bufferedEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
            const timeRemaining = this.videoElement.duration - bufferedEnd;
            if (timeRemaining <= 0.5) {
                console.log('Video fully buffered');
            }
        }
    }
    
    onTimeUpdate() {
        // Check if we're close to the end of the buffer
        if (this.videoElement.buffered.length > 0) {
            const currentTime = this.videoElement.currentTime;
            const bufferedEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
            
            // If we're getting close to the end of the buffer, try to load more
            if (bufferedEnd - currentTime < 2) {
                this.videoElement.load();
            }
        }
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