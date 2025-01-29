class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        
        if (!this.video) return;
        
        // Enhanced video playback settings for hardware acceleration
        Object.assign(this.video, {
            loop: false,
            muted: true,
            playsInline: true,
            preload: 'auto',
            autoplay: true,
            controls: false,
            volume: 0,
            crossOrigin: 'anonymous',
            // Hardware acceleration hints
            'webkit-playsinline': true,
            'x-webkit-airplay': 'allow'
        });

        // Advanced hardware acceleration and performance optimizations
        this.video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            transform: translateZ(0);
            transform: translate3d(0,0,0);
            -webkit-transform: translateZ(0);
            -webkit-transform: translate3d(0,0,0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            perspective: 1000;
            -webkit-perspective: 1000;
            will-change: transform;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
            position: fixed;
            top: 0;
            left: 0;
            z-index: 1;
        `;

        // Force GPU acceleration on the container
        document.body.style.cssText = `
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            backface-visibility: hidden;
            -webkit-backface-visibility: hidden;
            perspective: 1000;
            -webkit-perspective: 1000;
            overflow: hidden;
            margin: 0;
            padding: 0;
            background: black;
        `;
        
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.videoDir = '/kiosk/videos/';
        this.saveVideoPath = '/raspberry-files/save-video.php';
        this.remoteVideoUrl = 'https://vinculo.com.py/new-player/api/content.php';
        
        // Remove loader if exists
        const loader = document.getElementById('loader');
        if (loader) loader.remove();
        
        // Preload next video
        this.nextVideo = document.createElement('video');
        Object.assign(this.nextVideo, {
            muted: true,
            preload: 'auto',
            style: 'display: none;'
        });
        document.body.appendChild(this.nextVideo);
        
        this.setupEventListeners();
        this.loadVideos();
        
        // Check for new videos every 5 minutes
        setInterval(() => {
            if (!document.hidden) this.loadVideos();
        }, 300000);
    }
    
    setupEventListeners() {
        // Optimized event listeners with passive flag
        this.video.addEventListener('ended', () => this.playNext(), { passive: true });
        this.video.addEventListener('error', () => this.handleError(), { passive: true });
        this.video.addEventListener('stalled', () => this.handleError(), { passive: true });
        
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
            this.loadVideos();
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
        const nextVideo = this.playlist[(this.currentIndex + 1) % this.playlist.length];
        
        if (!video?.url) {
            this.isPlaying = false;
            return;
        }

        try {
            // Check if video exists locally
            const checkResponse = await fetch(`/raspberry-files/check-video.php?filename=${video.filename}`);
            const checkResult = await checkResponse.json();
            
            // Clean up current video with optimized cleanup
            this.video.pause();
            this.video.removeAttribute('src');
            this.video.load();
            
            // Set video source
            const videoUrl = checkResult.exists ? 
                `${this.videoDir}${video.filename}` : 
                video.url;
                
            console.log('Playing video:', videoUrl, 'Local:', checkResult.exists);
            
            // Preload next video
            if (nextVideo) {
                const nextCheckResponse = await fetch(`/raspberry-files/check-video.php?filename=${nextVideo.filename}`);
                const nextCheckResult = await nextCheckResponse.json();
                const nextVideoUrl = nextCheckResult.exists ? 
                    `${this.videoDir}${nextVideo.filename}` : 
                    nextVideo.url;
                this.nextVideo.src = nextVideoUrl;
            }
            
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
            setTimeout(() => this.loadVideos(), 5000);
        }
    }

    updatePlaylist(videos) {
        const newVideos = JSON.stringify(videos);
        if (JSON.stringify(this.playlist) !== newVideos) {
            console.log('Updating playlist with new videos');
            this.playlist = videos;
            if (!this.isPlaying) this.playNext();
        }
    }

    async downloadVideos(videos) {
        for (const video of videos) {
            try {
                // Check if video exists locally
                const checkResponse = await fetch(`/raspberry-files/check-video.php?filename=${video.filename}`);
                const checkResult = await checkResponse.json();
                
                if (!checkResult.exists) {
                    console.log('Downloading new video:', video.filename);
                    const response = await fetch(video.url);
                    
                    if (!response.ok) {
                        throw new Error(`Failed to download video: ${response.status}`);
                    }
                    
                    const blob = await response.blob();
                    const formData = new FormData();
                    formData.append('video', new File([blob], video.filename, { type: video.type }));
                    
                    const saveResponse = await fetch(this.saveVideoPath, {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!saveResponse.ok) {
                        const error = await saveResponse.text();
                        throw new Error(`Failed to save video: ${error}`);
                    }
                    
                    console.log('Video downloaded and saved:', video.filename);
                } else {
                    console.log('Video already exists locally:', video.filename);
                }
            } catch (error) {
                console.error('Error downloading video:', video.filename, error);
            }
        }
    }
}

// Start player
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new VideoPlayer());
} else {
    new VideoPlayer();
}