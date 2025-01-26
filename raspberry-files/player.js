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
        
        // Basic video settings
        this.video.loop = false;
        this.video.muted = true;
        this.video.playsInline = true;
        
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
                url: 'file://' + localPath,
                type: 'video/mp4'
            }]);
        }
    }

    async downloadVideos(videos) {
        for (const video of videos) {
            try {
                // Check if we already have this video locally
                const localPath = `${this.videoDir}${video.filename}`;
                try {
                    const localResponse = await fetch(`file://${localPath}`);
                    if (localResponse.ok) {
                        console.log(`Video ${video.filename} already exists locally`);
                        video.url = `file://${localPath}`;
                        continue;
                    }
                } catch (e) {
                    console.log(`Video ${video.filename} not found locally, downloading...`);
                }

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
                
                // Verify the file was saved
                const savedSize = result.size;
                if (!savedSize || savedSize === 0) {
                    throw new Error(`Video file ${video.filename} was not saved properly`);
                }
                
                // Update the video URL to point to local file
                video.url = `file://${localPath}`;
                console.log(`Successfully downloaded and saved ${video.filename} to ${video.url}`);
                
                // Verify we can access the local file
                try {
                    const verifyResponse = await fetch(video.url);
                    if (!verifyResponse.ok) {
                        throw new Error('Cannot access local file');
                    }
                } catch (e) {
                    throw new Error(`Cannot verify local file: ${e.message}`);
                }
                
            } catch (error) {
                console.error(`Failed to download video ${video.filename}:`, error);
                // Only fall back to remote URL if we must
                if (!video.url.startsWith('file://')) {
                    console.log(`Falling back to remote URL for ${video.filename}`);
                } else {
                    // If we were trying to use a local file that failed, try the remote URL
                    video.url = video.url.replace('file://' + this.videoDir, 'https://vinculo.com.py/new-player/videos/');
                    console.log(`Falling back to remote URL: ${video.url}`);
                }
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
        this.video.addEventListener('loadstart', () => {
            if (this.loader) this.loader.style.display = 'block';
        });
        
        this.video.addEventListener('canplay', () => {
            if (this.loader) this.loader.style.display = 'none';
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