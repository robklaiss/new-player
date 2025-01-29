class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        
        if (!this.video) return;
        
        // Optimize video playback settings
        Object.assign(this.video, {
            loop: false,
            muted: true,
            playsInline: true,
            preload: 'auto',  // Changed from metadata to auto
            autoplay: true,   // Enable autoplay
            controls: false,
            volume: 0,
            crossOrigin: 'anonymous'
        });

        // Hardware acceleration and performance optimizations
        this.video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            transform: translate3d(0,0,0);
            -webkit-transform: translate3d(0,0,0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            perspective: 1000;
            -webkit-perspective: 1000;
            will-change: transform;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
        `;
        
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.videoDir = '/kiosk/videos/';  // Changed to match Apache alias
        this.saveVideoPath = '/raspberry-files/save-video.php';
        this.remoteVideoUrl = 'https://vinculo.com.py/new-player/api/content.php';
        
        // Remove loader if exists
        const loader = document.getElementById('loader');
        if (loader) loader.remove();
        
        this.setupEventListeners();
        this.loadVideos();
        
        // Check for new videos more frequently (every 30 minutes)
        setInterval(() => {
            if (!document.hidden) this.loadVideos();
        }, 1800000);
        
        // Memory management
        setInterval(() => {
            if (window.gc) window.gc();
        }, 300000);
    }
    
    setupEventListeners() {
        // Handle video events
        this.video.addEventListener('ended', () => this.playNext(), { passive: true });
        this.video.addEventListener('error', () => this.handleError(), { passive: true });
        this.video.addEventListener('stalled', () => this.handleError(), { passive: true });
        this.video.addEventListener('waiting', () => {
            if (this.video.readyState < 3) {  // HAVE_FUTURE_DATA
                setTimeout(() => this.handleError(), 5000);  // Wait 5s before retry
            }
        }, { passive: true });
        
        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !this.isPlaying) {
                this.playNext();
            }
        }, { passive: true });
    }

    handleError() {
        console.error('Video error:', this.video.error);
        if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            setTimeout(() => this.playNext(), 1000);
        } else {
            this.retryCount = 0;
            this.loadVideos();  // Reload playlist on persistent errors
        }
    }

    async playNext() {
        if (!this.playlist.length) {
            await this.loadVideos();
            return;
        }
        
        this.isPlaying = true;
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        const video = this.playlist[this.currentIndex];
        
        if (!video?.url) {
            this.isPlaying = false;
            return;
        }

        try {
            // Check if video exists locally
            const checkResponse = await fetch(`/raspberry-files/check-video.php?filename=${video.filename}`);
            const checkResult = await checkResponse.json();
            
            // Clean up current video
            this.video.pause();
            this.video.removeAttribute('src');
            this.video.load();
            
            // Force memory cleanup
            if (window.gc) window.gc();
            
            // Small delay for cleanup
            await new Promise(r => setTimeout(r, 100));
            
            // Set video source
            const videoUrl = checkResult.exists ? 
                `${this.videoDir}${video.filename}` : 
                video.url;
                
            console.log('Playing video:', videoUrl, 'Local:', checkResult.exists);
            this.video.src = videoUrl;
            
            // Reset retry count on successful play
            this.video.play().then(() => {
                this.retryCount = 0;
                this.status.textContent = video.filename;
                this.status.style.display = 'block';
                setTimeout(() => {
                    this.status.style.display = 'none';
                }, 3000);
            }).catch(error => {
                console.error('Play error:', error);
                this.handleError();
            });
            
        } catch (error) {
            console.error('Playback error:', error);
            this.handleError();
        }
    }

    async loadVideos() {
        try {
            console.log('Fetching videos from:', this.remoteVideoUrl);
            const response = await fetch(this.remoteVideoUrl, {
                headers: { 
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) throw new Error('Failed to fetch videos');
            
            const data = await response.json();
            console.log('Received video data:', data);
            
            if (data.content?.videos?.length > 0) {
                const videos = Array.isArray(data.content.videos) ? 
                    data.content.videos : [data.content.videos];
                    
                console.log('Processing videos:', videos);
                await this.downloadVideos(videos);
                this.updatePlaylist(videos);
            } else {
                throw new Error('No videos in response');
            }
        } catch (error) {
            console.error('Error loading videos:', error);
            // Don't fall back to default video, retry current playlist instead
            if (!this.playlist.length) {
                setTimeout(() => this.loadVideos(), 5000);
            }
        }
    }

    updatePlaylist(videos) {
        const newVideos = JSON.stringify(videos);
        if (JSON.stringify(this.playlist) !== newVideos) {
            this.playlist = videos;
            if (!this.isPlaying) this.playNext();
        }
    }

    async downloadVideos(videos) {
        for (const video of videos) {
            try {
                console.log('Checking video:', video.filename);
                const checkResponse = await fetch(`/raspberry-files/check-video.php?filename=${video.filename}`);
                const checkResult = await checkResponse.json();
                
                if (!checkResult.exists) {
                    console.log('Downloading video:', video.url);
                    const response = await fetch(video.url, { 
                        method: 'GET',
                        cache: 'no-cache'
                    });
                    
                    if (!response.ok) {
                        console.error('Download failed:', response.status);
                        continue;
                    }
                    
                    const blob = await response.blob();
                    const formData = new FormData();
                    formData.append('video', blob, video.filename);
                    
                    console.log('Saving video:', video.filename);
                    const saveResponse = await fetch(this.saveVideoPath, {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!saveResponse.ok) {
                        throw new Error('Save failed: ' + saveResponse.status);
                    }
                    
                    console.log('Video saved successfully:', video.filename);
                } else {
                    console.log('Video already exists locally:', video.filename);
                }
            } catch (error) {
                console.error('Error processing video:', video.filename, error);
            }
        }
    }
}

// Start player
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new VideoPlayer(), { passive: true });
} else {
    new VideoPlayer();
}