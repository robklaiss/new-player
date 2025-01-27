class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        this.loader = document.getElementById('loader');
        this.playlist = [];
        this.currentIndex = -1;
        
        if (!this.video) {
            console.error('Video element not found');
            return;
        }
        
        // Most minimal video settings
        this.video.loop = false;
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.preload = 'none'; // Even more aggressive - only load when needed
        
        // Force hardware acceleration and reduce quality for performance
        this.video.style.transform = 'translateZ(0)';
        this.video.style.width = '100%';
        this.video.style.height = '100%';
        this.video.style.objectFit = 'contain';
        
        // Reduce memory usage by limiting video buffer
        if (this.video.bufferSize !== undefined) {
            this.video.bufferSize = 5 * 1024 * 1024; // 5MB buffer
        }
        
        this.videoDir = '/var/www/kiosk/videos/';
        this.saveVideoPath = '/raspberry-files/save-video.php';
        this.remoteVideoUrl = 'https://vinculo.com.py/new-player/api/content.php';
        
        if (this.loader) {
            this.loader.remove(); // Remove completely instead of just hiding
        }
        
        // Setup minimal event listeners
        this.setupEventListeners();
        
        console.log('Starting video player...');
        this.loadVideos();
        
        // Check for new videos less frequently
        setInterval(() => this.loadVideos(), 7200000); // Every 2 hours
    }
    
    setupEventListeners() {
        // Minimize event listeners to reduce overhead
        this.video.addEventListener('ended', () => {
            this.playNext();
        });

        this.video.addEventListener('error', (e) => {
            console.error('Video error:', e);
            this.playNext();
        });

        // Add minimal stall recovery
        this.video.addEventListener('stalled', () => {
            this.video.load();
            this.video.play().catch(() => this.playNext());
        });
    }

    async playNext() {
        if (this.playlist.length === 0) {
            this.updateStatus('No hay videos disponibles');
            return;
        }
        
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        const video = this.playlist[this.currentIndex];
        
        if (!video?.url) {
            setTimeout(() => this.playNext(), 1000);
            return;
        }

        try {
            // Garbage collection hint
            if (window.gc) window.gc();
            
            // Clean up current video
            this.video.src = '';
            this.video.removeAttribute('src');
            this.video.load();
            
            // Small delay to ensure cleanup
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Load and play new video
            this.video.src = `${this.videoDir}${video.filename}`;
            await this.video.play();
            
        } catch (error) {
            setTimeout(() => this.playNext(), 1000);
        }
    }
    
    updateStatus(message) {
        if (this.status) {
            this.status.textContent = message;
        }
    }
    
    async loadVideos() {
        try {
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
                await this.downloadVideos(videos);
                this.updatePlaylist(videos);
            } else {
                throw new Error('No videos available from API');
            }
        } catch (error) {
            console.warn('Failed to fetch remote videos:', error);
            const filename = 'verano-pile-opt-ok.mp4';
            this.updatePlaylist([{
                filename: filename,
                url: 'https://vinculo.com.py/new-player/videos/' + filename,
                type: 'video/mp4'
            }]);
        }
    }

    updatePlaylist(videos) {
        // Only update if playlist actually changed to avoid unnecessary reloads
        const newVideos = JSON.stringify(videos);
        if (JSON.stringify(this.playlist) !== newVideos) {
            this.playlist = videos;
            if (this.currentIndex === -1) {
                this.playNext();
            }
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
}

// Start player when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting player...');
    new VideoPlayer();
});