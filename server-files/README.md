# Server Setup Instructions

1. In your Gator cPanel:
   - Navigate to File Manager
   - Go to the public_html directory
   - Create a new directory called `new-player`
   - Inside `new-player`, create a directory called `api`
   - Inside `api`, create a directory called `videos`

2. Upload these files to the following locations:
   - `/new-player/api/update.php`
   - `/new-player/api/content.php`

3. Upload your video files:
   - Place your MP4 video files in the `/new-player/api/videos/` directory
   - Make sure the videos are readable by the web server:
     ```bash
     chmod 644 /new-player/api/videos/*.mp4
     ```

4. Set proper permissions:
   ```bash
   chmod 755 /new-player/api
   chmod 644 /new-player/api/*.php
   chmod 755 /new-player/api/videos
   ```

5. Test the API:
   - Visit `https://vinculo.com.py/new-player/api/content.php`
   - You should see a JSON response with the video information

Note: Make sure PHP is enabled in your cPanel and the directories have proper permissions.
