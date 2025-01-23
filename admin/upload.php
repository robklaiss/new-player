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
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE => 'The uploaded file exceeds the upload_max_filesize directive in php.ini',
            UPLOAD_ERR_FORM_SIZE => 'The uploaded file exceeds the MAX_FILE_SIZE directive in the HTML form',
            UPLOAD_ERR_PARTIAL => 'The uploaded file was only partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing a temporary folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
            UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the file upload'
        ];
        $errorMessage = isset($errorMessages[$file['error']]) ? $errorMessages[$file['error']] : 'Unknown upload error';
        throw new Exception('File upload failed: ' . $errorMessage);
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
    $videosDir = '../videos';
    $dataDir = '../data';
    $targetPath = $videosDir . '/' . $filename;

    // Create directories if they don't exist
    foreach ([$videosDir, $dataDir] as $dir) {
        if (!file_exists($dir)) {
            if (!@mkdir($dir, 0775, true)) {
                throw new Exception("Failed to create directory: $dir");
            }
            @chmod($dir, 0775);
        } elseif (!is_writable($dir)) {
            throw new Exception("Directory not writable: $dir");
        }
    }

    // Move file to videos directory
    if (!@move_uploaded_file($file['tmp_name'], $targetPath)) {
        throw new Exception('Failed to save video file. Check directory permissions.');
    }
    @chmod($targetPath, 0664);

    // Update videos.json
    $videosFile = $dataDir . '/videos.json';
    if (!file_exists($videosFile)) {
        if (!@file_put_contents($videosFile, json_encode(['videos' => []]))) {
            throw new Exception('Failed to create videos.json');
        }
        @chmod($videosFile, 0664);
    }

    $videos = json_decode(file_get_contents($videosFile), true);
    if (!isset($videos['videos'])) {
        $videos = ['videos' => []];
    }

    // Add new video to list if not already present
    if (!in_array($filename, $videos['videos'])) {
        $videos['videos'][] = $filename;
    }

    if (!@file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT))) {
        throw new Exception('Failed to update videos.json');
    }

    log_event('upload_success', ['filename' => $filename]);
    $response['success'] = true;
    $response['filename'] = $filename;

} catch (Exception $e) {
    log_event('upload_error', ['error' => $e->getMessage()]);
    $response['error'] = $e->getMessage();
}

echo json_encode($response);
