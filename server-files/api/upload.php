<?php
require_once 'config.php';
header('Content-Type: application/json');

try {
    verify_api_key();
    
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Only POST method is allowed');
    }

    if (!isset($_FILES['video'])) {
        throw new Exception('No video file uploaded');
    }

    $file = $_FILES['video'];
    
    // Validate file
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('File upload failed with error code: ' . $file['error']);
    }

    // Validate file type
    $allowedTypes = ['video/mp4', 'video/webm'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if (!in_array($mimeType, $allowedTypes)) {
        throw new Exception('Invalid file type. Only MP4 and WebM videos are allowed.');
    }

    // Generate unique filename
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid() . '.' . $extension;
    $targetPath = VIDEOS_DIR . $filename;

    // Move file to videos directory
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        throw new Exception('Failed to save video file');
    }

    // Update rotation file
    $rotation = json_decode(file_get_contents(ROTATION_FILE), true);
    $rotation['last_rotation'] = time();
    file_put_contents(ROTATION_FILE, json_encode($rotation));

    // Log the upload
    log_event('video_upload', [
        'filename' => $filename,
        'original_name' => $file['name'],
        'size' => $file['size']
    ]);

    echo json_encode([
        'success' => true,
        'filename' => $filename
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    
    log_event('error', [
        'type' => 'video_upload',
        'message' => $e->getMessage()
    ]);
}
