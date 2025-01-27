class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        this.loader = document.getElementById('loader');
        this.playlist = [];
        this.currentIndex = -1;
        this.nextVideo = null;
        
        if (!this.video) {
            console.error('Video element not found');
            return;
        }
        
        // Enhanced video settings for better performance
        this.video.loop = false;
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.preload = 'auto';
        
        // Enable hardware acceleration
        this.video.style.transform = 'translateZ(0)';
        this.video.style.backfaceVisibility = 'hidden';
        
        // Add additional video attributes for better performance
        this.video.setAttribute('playsinline', '');
        this.video.setAttribute('webkit-playsinline', '');
        this.video.setAttribute('x-webkit-airplay', 'allow');
        
        // Set optimal buffering strategy
        this.video.preload = 'auto';
        this.video.autobuffer = true;
        
        // Local video directory and paths
        this.videoDir = '/var/www/kiosk/videos/';
        this.saveVideoPath = '/raspberry-files/save-video.php';
        
        // Remote video URL
        this.remoteVideoUrl = 'https://vinculo.com.py/new-player/api/content.php';
        
        // Hide loader permanently - we don't need it for video transitions
        if (this.loader) {
            this.loader.style.display = 'none';
        }
        
        // Add video event listeners with enhanced error handling
        this.setupEventListeners();
        
        // Start loading videos
        console.log('Starting video player...');
        this.loadVideos();
        
        // Check for new videos every hour instead of every minute to reduce overhead
        setInterval(() => this.loadVideos(), 3600000);
    }
    
    async loadVideos() {
        try {
            // Try to fetch from remote API
            const response = await fetch(this.remoteVideoUrl, {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('HTTP error! status: ' + response.status);
            }
            
            const data = await response.json();
            if (data.content && data.content.videos && data.content.videos.length > 0) {
                const videos = Array.isArray(data.content.videos) ? data.content.videos : [data.content.videos];
                // Download videos before updating playlist
                await this.downloadVideos(videos);
                this.updatePlaylist(videos);
            } else {
                throw new Error('No videos available from API');
            }
        } catch (error) {
            console.warn('Failed to fetch remote videos:', error);
            // If remote fetch fails, try to use local files directly
            const filename = 'verano-pile-opt-ok.mp4';
            const localPath = this.videoDir + filename;
            this.updatePlaylist([{
                filename: filename,
                url: 'https://vinculo.com.py/new-player/videos/' + filename,
                type: 'video/mp4'
            }]);
        }
    }

    async downloadVideos(videos) {
        for (const video of videos) {
            try {
                // Log the attempt
                console.log(`Processing video: ${video.filename}`);
                
                // Check if video exists locally
                const localPath = `${this.videoDir}${video.filename}`;
                console.log(`Checking local path: ${localPath}`);
                
                try {
                    const response = await fetch(video.url, {
                        method: 'GET',
                        cache: 'no-store'
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Download failed: ${response.status}`);
                    }
                    
                    // Get video data
                    const blob = await response.blob();
                    console.log(`Downloaded video size: ${blob.size} bytes`);
                    
                    // Save locally
                    const formData = new FormData();
                    formData.append('video', blob, video.filename);
                    
                    console.log('Saving to local storage...');
                    const saveResponse = await fetch(this.saveVideoPath, {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!saveResponse.ok) {
                        const text = await saveResponse.text();
                        console.error('Save response:', text);
                        throw new Error(`Save failed with status ${saveResponse.status}`);
                    }
                    
                    const result = await saveResponse.json();
                    console.log('Save result:', result);
                    
                    if (!result.success) {
                        throw new Error(result.error || 'Failed to save video');
                    }
                    
                    // Update video URL to use local path
                    video.url = `/kiosk/videos/${video.filename}`;
                    console.log(`Video saved successfully: ${video.url}`);
                    
                } catch (error) {
                    console.error(`Error downloading ${video.filename}:`, error);
                    // Keep the remote URL as fallback
                    video.url = `https://vinculo.com.py/new-player/videos/${video.filename}`;
                }
            } catch (error) {
                console.error(`Failed to process ${video.filename}:`, error);
            }
        }
    }
    
    updatePlaylist(videos) {
        this.playlist = videos;
        console.log('Playlist updated:', this.playlist.length, 'videos');
        
        if (this.playlist.length === 0) {
            throw new Error('No se pudieron encontrar videos');
        }
        
        // Start playback if needed
        if (!this.video.src || this.video.error || !this.video.currentTime) {
            this.playNext();
        }
    }
    
    async playNext() {
        if (this.playlist.length === 0) {
            this.updateStatus('No hay videos disponibles');
            return;
        }
        
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        const video = this.playlist[this.currentIndex];
        
        if (!video || !video.url) {
            console.error('Invalid video or missing URL:', video);
            setTimeout(() => this.playNext(), 1000);
            return;
        }
        
        // Improved preloading strategy
        const nextIndex = (this.currentIndex + 1) % this.playlist.length;
        const nextVideo = this.playlist[nextIndex];
        
        try {
            // Load current video
            this.video.src = `${this.videoDir}${video.filename}`;
            await this.video.play();
            
            // Preload next video
            if (nextVideo && nextVideo.url) {
                if (this.nextVideo) {
                    this.nextVideo.remove();
                }
                this.nextVideo = document.createElement('video');
                this.nextVideo.style.display = 'none';
                this.nextVideo.preload = 'auto';
                this.nextVideo.src = `${this.videoDir}${nextVideo.filename}`;
                document.body.appendChild(this.nextVideo);
                
                // Start preloading but don't wait for it
                this.nextVideo.load();
            }
        } catch (error) {
            console.error('Error playing video:', error);
            setTimeout(() => this.playNext(), 1000);
        }
    }
    
    updateStatus(message) {
        console.log('Status:', message);
        if (this.status) {
            this.status.textContent = message;
        }
    }
    
    setupEventListeners() {
        // Enhanced error handling and recovery
        this.video.addEventListener('error', (e) => {
            console.error('Video error:', e);
            // Try to recover from error by reloading current video
            const currentVideo = this.playlist[this.currentIndex];
            if (currentVideo) {
                console.log('Attempting to recover from error...');
                this.video.load();
                this.video.play().catch(err => {
                    console.error('Recovery failed:', err);
                    this.playNext(); // Move to next video if recovery fails
                });
            }
        });

        this.video.addEventListener('ended', () => {
            console.log('Video ended, playing next...');
            this.playNext();
        });

        // Add stall detection and recovery
        this.video.addEventListener('stalled', () => {
            console.log('Video stalled, attempting to recover...');
            setTimeout(() => {
                this.video.load();
                this.video.play().catch(console.error);
            }, 1000);
        });

        // Monitor buffering
        this.video.addEventListener('waiting', () => {
            console.log('Video buffering...');
        });

        // Clear memory when possible
        this.video.addEventListener('emptied', () => {
            if (this.nextVideo) {
                this.nextVideo.src = '';
                this.nextVideo.load();
            }
        });
    }
}

// Start player when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting player...');
    new VideoPlayer();
});