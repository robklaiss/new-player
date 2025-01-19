// Admin panel functionality
const API_BASE = '/new-player';
const VIDEOS_DIR = '/new-player/videos';

// Handle file upload
document.getElementById('uploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const fileInput = form.querySelector('#videoFile');
    const progressBar = document.querySelector('#uploadProgress .progress-bar');
    const uploadProgress = document.getElementById('uploadProgress');
    const messageDiv = document.getElementById('uploadMessage');
    
    if (!fileInput.files.length) {
        showMessage('Please select a file first.', 'danger');
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('video', file);
    formData.append('filename', file.name);

    try {
        uploadProgress.style.display = 'block';
        messageDiv.style.display = 'none';

        const response = await fetch(`${API_BASE}/admin/upload.php`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        showMessage('Video uploaded successfully!', 'success');
        form.reset();
        loadVideos(); // Refresh video list
    } catch (error) {
        showMessage(error.message, 'danger');
    } finally {
        uploadProgress.style.display = 'none';
    }
});

// Helper function to show messages
function showMessage(message, type) {
    const messageDiv = document.getElementById('uploadMessage');
    messageDiv.className = `alert alert-${type} mt-3`;
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
}

// Load and display devices
async function loadDevices() {
    try {
        const response = await fetch(`${API_BASE}/admin/devices.php`);
        
        if (!response.ok) {
            throw new Error(`Failed to load devices: ${response.statusText}`);
        }

        const data = await response.json();
        const deviceList = document.getElementById('deviceList');
        deviceList.innerHTML = '';

        data.devices.forEach(device => {
            const card = document.createElement('div');
            card.className = 'col-md-4 device-card';
            card.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">Device ${device.id}</h5>
                        <p class="card-text">
                            Status: ${device.status || 'Unknown'}<br>
                            Last Seen: ${new Date(device.last_seen * 1000).toLocaleString()}<br>
                            IP: ${device.ip || 'Unknown'}
                        </p>
                    </div>
                </div>
            `;
            deviceList.appendChild(card);
        });
    } catch (error) {
        showMessage(error.message, 'danger');
    }
}

// Load and display videos
async function loadVideos() {
    try {
        const response = await fetch(`${API_BASE}/admin/videos.php`);
        
        if (!response.ok) {
            throw new Error(`Failed to load videos: ${response.statusText}`);
        }

        const data = await response.json();
        const videoList = document.getElementById('videoList');
        videoList.innerHTML = '';

        data.videos.forEach(video => {
            const item = document.createElement('div');
            item.className = 'list-group-item d-flex justify-content-between align-items-center';
            item.innerHTML = `
                <div>
                    <h6 class="mb-1">${video.name}</h6>
                    <small>Size: ${formatFileSize(video.size)}</small>
                </div>
                <div>
                    <button class="btn btn-sm btn-danger" onclick="deleteVideo('${video.name}')">Delete</button>
                </div>
            `;
            videoList.appendChild(item);
        });
    } catch (error) {
        showMessage(error.message, 'danger');
    }
}

// Delete video
async function deleteVideo(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/delete.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filename })
        });

        if (!response.ok) {
            throw new Error(`Failed to delete video: ${response.statusText}`);
        }

        showMessage(`${filename} deleted successfully`, 'success');
        loadVideos(); // Refresh video list
    } catch (error) {
        showMessage(error.message, 'danger');
    }
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initial load
loadDevices();
loadVideos();

// Refresh data periodically
setInterval(loadDevices, 30000);
setInterval(loadVideos, 30000);
