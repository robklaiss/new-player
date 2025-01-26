class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        this.loader = document.getElementById('loader');
        this.playlist = [];
        this.currentIndex = -1;
        this.isFirstLoad = true;
        
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
        
        // Hide loader initially
        if (this.loader) this.loader.style.display = 'none';
        
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
                console.log(`Downloading video from: ${video.url}`);
                const response = await fetch(video.url, {
                    method: 'GET',
                    cache: 'no-store' // Prevent caching
                });
                
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                // Check content type and size
                const contentType = response.headers.get('content-type');
                const contentLength = response.headers.get('content-length');
                console.log(`Content-Type: ${contentType}, Size: ${contentLength} bytes`);
                
                // Create a Blob from the video data
                const blob = await response.blob();
                console.log(`Video blob size: ${blob.size} bytes`);
                
                // Create a FormData object
                const formData = new FormData();
                formData.append('video', blob, video.filename);
                
                // Send the video to PHP endpoint that will save it
                console.log(`Saving video ${video.filename} to server...`);
                const saveResponse = await fetch('/raspberry-files/save-video.php', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await saveResponse.json();
                console.log('Save response:', result);
                
                if (!saveResponse.ok) {
                    throw new Error(`Failed to save video ${video.filename}: ${JSON.stringify(result)}`);
                }
                
                // Update the video URL to point to remote URL (local file:// protocol doesn't work in browser)
                video.url = 'https://vinculo.com.py/new-player/videos/' + video.filename;
                console.log(`Successfully downloaded video ${video.filename}`);
                
            } catch (error) {
                console.error(`Failed to download video ${video.filename}:`, error);
                // Keep using the remote URL
                console.log(`Using remote URL for ${video.filename}: ${video.url}`);
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
        
        // Preload the next video
        const nextIndex = (this.currentIndex + 1) % this.playlist.length;
        const nextVideo = this.playlist[nextIndex];
        if (nextVideo && nextVideo.url) {
            const preloadLink = document.createElement('link');
            preloadLink.rel = 'preload';
            preloadLink.as = 'video';
            preloadLink.href = nextVideo.url;
            document.head.appendChild(preloadLink);
        }
        
        console.log('Playing next video:', video.filename);
        this.video.src = video.url;
        this.video.load();
        this.video.play().catch(error => {
            console.error('Error playing video:', error);
            setTimeout(() => this.playNext(), 2000);
        });
    }
    
    updateStatus(message) {
        console.log('Status:', message);
        if (this.status) {
            this.status.textContent = message;
        }
    }
    
    setupEventListeners() {
        // Only show loader on first load
        this.video.addEventListener('loadstart', () => {
            if (this.isFirstLoad && this.loader) {
                this.loader.style.display = 'block';
            }
        });
        
        this.video.addEventListener('canplay', () => {
            if (this.loader) {
                this.loader.style.display = 'none';
                this.isFirstLoad = false;
            }
        });
        
        this.video.addEventListener('playing', () => {
            if (this.loader) this.loader.style.display = 'none';
        });
        
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