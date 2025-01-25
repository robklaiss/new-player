class VideoPlayer {
    constructor() {
        this.video = document.getElementById('video');
        this.status = document.getElementById('status');
        
        if (!this.video) {
            console.error('Video element not found');
            return;
        }
        
        // Set up video
        this.video.loop = true;
        this.video.muted = true;
        this.video.playsInline = true;
        
        // Load and play video
        this.loadVideo();
        
        // Check for new video every minute
        setInterval(() => this.loadVideo(), 60000);
    }
    
    async loadVideo() {
        try {
            const response = await fetch('https://vinculo.com.py/new-player/api/content.php');
            const data = await response.json();
            
            if (data.content && data.content.video) {
                if (this.video.src !== data.content.video) {
                    console.log('Loading new video:', data.content.video);
                    this.video.src = data.content.video;
                    this.video.load();
                    this.video.play();
                }
            }
        } catch (error) {
            console.error('Error loading video:', error);
        }
    }
}

// Start player when page loads
document.addEventListener('DOMContentLoaded', () => {
    new VideoPlayer();
});