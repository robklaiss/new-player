class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        
        if (!this.video) return;
        
        // Set optimal video constraints
        Object.assign(this.video, {
            loop: false,
            muted: true,
            playsInline: true,
            preload: 'metadata',
            autoplay: false,
            controls: false,
            volume: 0
        });

        // Set video quality constraints
        this.video.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            transform: translateZ(0);
            -webkit-transform: translateZ(0);
            image-rendering: optimizespeed;
            max-width: 1280px;
            max-height: 720px;
        `;
        
        // Force lower quality playback
        if ('mediaSource' in window) {
            this.video.addEventListener('loadedmetadata', () => {
                const track = this.video.videoTracks?.[0];
                if (track) {
                    // Limit FPS and resolution if possible
                    if (track.getSettings) {
                        const settings = track.getSettings();
                        if (settings.frameRate > 30) {
                            track.applyConstraints({
                                frameRate: 30,
                                width: { max: 1280 },
                                height: { max: 720 }
                            }).catch(() => {});
                        }
                    }
                }
            });
        }
        
        this.playlist = [];
        this.currentIndex = -1;
        this.isPlaying = false;
        
        this.videoDir = '/var/www/kiosk/videos/';
        this.saveVideoPath = '/raspberry-files/save-video.php';
        this.remoteVideoUrl = 'https://vinculo.com.py/new-player/api/content.php';
        
        // Remove loader if exists
        const loader = document.getElementById('loader');
        if (loader) loader.remove();
        
        this.setupEventListeners();
        this.loadVideos();
        
        // Check for new videos every 2 hours
        setInterval(() => {
            if (!document.hidden) this.loadVideos();
        }, 7200000);
    }
    
    setupEventListeners() {
        const handler = (event) => {
            if (!this.isPlaying) {
                switch(event.type) {
                    case 'ended':
                    case 'error':
                        this.playNext();
                        break;
                }
            }
        };
        
        ['ended', 'error'].forEach(event => {
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
            // Check if video exists locally
            const checkResponse = await fetch(`/raspberry-files/check-video.php?filename=${video.filename}`);
            const checkResult = await checkResponse.json();
            
            // Clean up current video
            this.video.pause();
            this.video.src = '';
            this.video.load();
            
            // Force GC if available
            if (window.gc) window.gc();
            
            // Small delay for cleanup
            await new Promise(r => setTimeout(r, 50));
            
            // Set video source
            this.video.src = checkResult.exists ? 
                `${this.videoDir}${video.filename}` : 
                video.url;
            
            // Play with quality constraints
            await this.video.play();
            
            // Set playback rate to reduce CPU usage
            this.video.playbackRate = 1.0;
            
        } catch (error) {
            this.isPlaying = false;
            setTimeout(() => this.playNext(), 1000);
        }
    }

    async loadVideos() {
        try {
            const response = await fetch(this.remoteVideoUrl, {
                headers: { 'Accept': 'application/json' }
            });
            
            if (!response.ok) throw new Error();
            
            const data = await response.json();
            if (data.content?.videos?.length > 0) {
                const videos = Array.isArray(data.content.videos) ? 
                    data.content.videos : [data.content.videos];
                await this.downloadVideos(videos);
                this.updatePlaylist(videos);
            }
        } catch {
            const filename = 'verano-pile-opt-ok.mp4';
            this.updatePlaylist([{
                filename: filename,
                url: 'https://vinculo.com.py/new-player/videos/' + filename,
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
                // Check if already exists
                const checkResponse = await fetch(`/raspberry-files/check-video.php?filename=${video.filename}`);
                const checkResult = await checkResponse.json();
                
                if (!checkResult.exists) {
                    const response = await fetch(video.url, { method: 'GET' });
                    if (!response.ok) continue;
                    
                    const blob = await response.blob();
                    const formData = new FormData();
                    formData.append('video', blob, video.filename);
                    
                    await fetch(this.saveVideoPath, {
                        method: 'POST',
                        body: formData
                    });
                }
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