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
        
        // Basic video settings
        this.video.loop = false;
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.preload = 'auto';
        
        // Local video directory
        this.videoDir = '/var/www/kiosk/videos/';
        
        // Remote video URL
        this.remoteVideoUrl = 'https://vinculo.com.py/new-player/api/content.php';
        
        // Hide loader permanently - we don't need it for video transitions
        if (this.loader) {
            this.loader.style.display = 'none';
        }
        
        // Add video event listeners
        this.setupEventListeners();
        
        // Start loading videos
        console.log('Starting video player...');
        this.loadVideos();
        
        // Check for new videos every minute
        setInterval(() => this.loadVideos(), 60000);
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
                
                // Check if video exists locally via HTTP
                const localUrl = `/kiosk/videos/${video.filename}`;
                try {
                    const localResponse = await fetch(localUrl, { method: 'HEAD' });
                    if (localResponse.ok) {
                        console.log(`Using existing local video: ${localUrl}`);
                        video.url = localUrl;
                        continue;
                    }
                } catch (e) {
                    console.log(`Local video not found: ${e.message}`);
                }

                // Download from remote
                console.log(`Downloading from remote: ${video.url}`);
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
                const saveResponse = await fetch('/raspberry-files/save-video.php', {
                    method: 'POST',
                    body: formData
                });
                
                const saveResult = await saveResponse.json();
                console.log('Save result:', saveResult);
                
                if (!saveResponse.ok || !saveResult.success) {
                    throw new Error(`Save failed: ${JSON.stringify(saveResult)}`);
                }
                
                // Verify local file exists
                console.log('Verifying local file...');
                const verifyResponse = await fetch(localUrl, { method: 'HEAD' });
                if (verifyResponse.ok) {
                    console.log(`Local file verified, using: ${localUrl}`);
                    video.url = localUrl;
                } else {
                    throw new Error('Local file verification failed');
                }
                
            } catch (error) {
                console.error(`Error processing ${video.filename}:`, error);
                // Fallback to remote URL
                video.url = 'https://vinculo.com.py/new-player/videos/' + video.filename;
                console.log(`Falling back to remote URL: ${video.url}`);
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
    
    playNext() {
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
        
        // Start preloading the next video immediately
        const nextIndex = (this.currentIndex + 1) % this.playlist.length;
        const nextVideo = this.playlist[nextIndex];
        if (nextVideo && nextVideo.url) {
            // Create a hidden video element to preload the next video
            if (this.nextVideo) {
                this.nextVideo.remove();
            }
            this.nextVideo = document.createElement('video');
            this.nextVideo.style.display = 'none';
            this.nextVideo.preload = 'auto';
            this.nextVideo.src = nextVideo.url;
            document.body.appendChild(this.nextVideo);
        }
        
        console.log('Playing next video:', video.filename);
        this.video.src = video.url;
        
        // Play immediately without showing loader
        const playPromise = this.video.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error('Error playing video:', error);
                setTimeout(() => this.playNext(), 2000);
            });
        }
    }
    
    updateStatus(message) {
        console.log('Status:', message);
        if (this.status) {
            this.status.textContent = message;
        }
    }
    
    setupEventListeners() {
        // Remove loadstart listener as we don't need the loader anymore
        
        this.video.addEventListener('error', () => {
            console.error('Video error');
            setTimeout(() => this.playNext(), 2000);
        });
        
        this.video.addEventListener('ended', () => {
            this.playNext();
        });
    }
}

// Start player when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting player...');
    new VideoPlayer();
});