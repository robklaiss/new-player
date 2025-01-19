<?php
require_once 'log.php';
header('Content-Type: application/json');

$response = ['success' => false, 'error' => null];

try {
    log_event('upload_start', ['method' => $_SERVER['REQUEST_METHOD']]);

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Only POST method is allowed');
    }

    if (!isset($_FILES['video'])) {
        throw new Exception('No video file uploaded');
    }

    $file = $_FILES['video'];
    
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

    // Use original filename but make it safe
    $filename = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $file['name']);
    $targetPath = '../videos/' . $filename;

    // Create videos directory if it doesn't exist
    if (!file_exists('../videos')) {
        mkdir('../videos', 0755, true);
    }

    // Move file to videos directory
    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        throw new Exception('Failed to save video file');
    }

    // Update videos.json
    $videosFile = '../data/videos.json';
    $videosDir = dirname($videosFile);
    
    if (!file_exists($videosDir)) {
        mkdir($videosDir, 0755, true);
    }

    $videos = [];
    if (file_exists($videosFile)) {
        $videos = json_decode(file_get_contents($videosFile), true);
    }

    $videos['videos'][] = [
        'name' => $filename,
        'uploaded' => time(),
        'size' => filesize($targetPath)
    ];

    file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT));

    $response['success'] = true;
    $response['filename'] = $filename;

    log_event('upload_success', [
        'filename' => $filename,
        'size' => filesize($targetPath),
        'mime_type' => $mimeType
    ]);

} catch (Exception $e) {
    http_response_code(500);
    $response['error'] = $e->getMessage();
    log_event('upload_error', [
        'error' => $e->getMessage(),
        'file' => isset($_FILES['video']) ? $_FILES['video']['name'] : 'no_file'
    ]);
}

echo json_encode($response);
