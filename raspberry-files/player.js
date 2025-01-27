class VideoPlayer {
    constructor() {
        // Minimize DOM queries
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        
        // Remove unnecessary elements
        const loader = document.getElementById('loader');
        if (loader) loader.remove();
        
        if (!this.video) return;
        
        // Absolute minimum video settings
        Object.assign(this.video, {
            loop: false,
            muted: true,
            playsInline: true,
            preload: 'none',
            autoplay: false,
            controls: false,
            poster: '',
            volume: 0
        });
        
        // Force low-quality mode for performance
        this.video.style.cssText = 
            'transform: translateZ(0);' +
            'width: 100%;' +
            'height: 100%;' +
            'object-fit: contain;' +
            'image-rendering: optimizeSpeed;' +
            'filter: none;' +
            '-webkit-filter: none;';
            
        // Minimal state
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        
        // Paths
        this.videoDir = '/var/www/kiosk/videos/';
        this.saveVideoPath = '/raspberry-files/save-video.php';
        this.remoteVideoUrl = 'https://vinculo.com.py/new-player/api/content.php';
        
        // Setup and start
        this.setupMinimalEvents();
        this.loadVideos();
        
        // Minimal polling
        setInterval(() => {
            if (!document.hidden) this.loadVideos();
        }, 7200000);
    }
    
    setupMinimalEvents() {
        // Single event handler for all events
        const handler = (event) => {
            switch(event.type) {
                case 'ended':
                case 'error':
                case 'stalled':
                    if (!this.isPlaying) this.playNext();
                    break;
            }
        };
        
        ['ended', 'error', 'stalled'].forEach(event => {
            this.video.addEventListener(event, handler, { passive: true });
        });
    }

    async playNext() {
        if (!this.playlist.length) return;
        
        this.isPlaying = true;
        this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
        const video = this.playlist[this.currentIndex];
        
        if (!video?.url) {
            this.isPlaying = false;
            return;
        }

        try {
            // Force cleanup
            this.video.pause();
            this.video.src = '';
            this.video.removeAttribute('src');
            this.video.load();
            
            // Force GC if available
            if (window.gc) window.gc();
            
            // Wait for cleanup
            await new Promise(r => setTimeout(r, 50));
            
            // Load new video
            this.video.src = `${this.videoDir}${video.filename}`;
            await this.video.play();
        } catch (error) {
            this.isPlaying = false;
            setTimeout(() => this.playNext(), 1000);
        }
    }
    
    async loadVideos() {
        try {
            const response = await fetch(this.remoteVideoUrl, {
                headers: { 'Accept': 'application/json' },
                cache: 'no-store'
            });
            
            if (!response.ok) throw new Error();
            
            const data = await response.json();
            const videos = data.content?.videos;
            
            if (Array.isArray(videos) && videos.length) {
                await this.downloadVideos(videos);
                this.updatePlaylist(videos);
            }
        } catch {
            // Fallback to default video
            this.updatePlaylist([{
                filename: 'verano-pile-opt-ok.mp4',
                url: 'https://vinculo.com.py/new-player/videos/verano-pile-opt-ok.mp4',
                type: 'video/mp4'
            }]);
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
                const response = await fetch(video.url, { 
                    method: 'GET',
                    cache: 'no-store'
                });
                
                if (!response.ok) continue;
                
                const blob = await response.blob();
                const formData = new FormData();
                formData.append('video', blob, video.filename);
                
                await fetch(this.saveVideoPath, {
                    method: 'POST',
                    body: formData
                });
            } catch {}
        }
    }
}

// Start player
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new VideoPlayer(), { passive: true });
} else {
    new VideoPlayer();
}