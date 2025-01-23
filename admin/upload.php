<?php
require_once 'log.php';
header('Content-Type: application/json');

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

$response = ['success' => false, 'error' => null, 'debug' => []];

// Add debug info
$response['debug']['post_max_size'] = ini_get('post_max_size');
$response['debug']['upload_max_filesize'] = ini_get('upload_max_filesize');
$response['debug']['memory_limit'] = ini_get('memory_limit');
$response['debug']['max_execution_time'] = ini_get('max_execution_time');

try {
    log_event('upload_start', ['method' => $_SERVER['REQUEST_METHOD']]);
    $response['debug']['request_method'] = $_SERVER['REQUEST_METHOD'];

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Only POST method is allowed');
    }

    // Debug POST and FILES
    $response['debug']['post'] = $_POST;
    $response['debug']['files'] = $_FILES;

    if (!isset($_FILES['video'])) {
        throw new Exception('No video file uploaded');
    }

    $file = $_FILES['video'];
    
    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errorMessages = [
            UPLOAD_ERR_INI_SIZE => 'The uploaded file exceeds the upload_max_filesize directive',
            UPLOAD_ERR_FORM_SIZE => 'The uploaded file exceeds the MAX_FILE_SIZE directive',
            UPLOAD_ERR_PARTIAL => 'The uploaded file was only partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing a temporary folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
            UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the file upload'
        ];
        $errorMessage = isset($errorMessages[$file['error']]) ? $errorMessages[$file['error']] : 'Unknown upload error';
        throw new Exception('File upload failed: ' . $errorMessage);
    }

    // Check file size
    $response['debug']['file_size'] = $file['size'];
    if ($file['size'] <= 0) {
        throw new Exception('Uploaded file is empty');
    }

    // Validate file type
    $allowedTypes = ['video/mp4', 'video/webm'];
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    
    $response['debug']['mime_type'] = $mimeType;
    if (!in_array($mimeType, $allowedTypes)) {
        throw new Exception('Invalid file type. Only MP4 and WebM videos are allowed.');
    }

    // Use original filename but make it safe
    $filename = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $file['name']);
    $videosDir = '../videos';
    $dataDir = '../data';
    $targetPath = $videosDir . '/' . $filename;

    // Debug paths
    $response['debug']['videos_dir'] = $videosDir;
    $response['debug']['target_path'] = $targetPath;
    $response['debug']['is_writable_videos'] = is_writable($videosDir);
    $response['debug']['is_writable_data'] = is_writable($dataDir);

    // Create directories if they don't exist
    foreach ([$videosDir, $dataDir] as $dir) {
        if (!file_exists($dir)) {
            if (!@mkdir($dir, 0777, true)) {
                throw new Exception("Failed to create directory: $dir");
            }
        } elseif (!is_writable($dir)) {
            throw new Exception("Directory not writable: $dir");
        }
    }

    // Move file to videos directory
    if (!@move_uploaded_file($file['tmp_name'], $targetPath)) {
        $error = error_get_last();
        throw new Exception('Failed to save video file: ' . ($error ? $error['message'] : 'Unknown error'));
    }
    @chmod($targetPath, 0666);

    // Update videos.json
    $videosFile = $dataDir . '/videos.json';
    if (!file_exists($videosFile)) {
        if (!@file_put_contents($videosFile, json_encode(['videos' => []]))) {
            throw new Exception('Failed to create videos.json');
        }
        @chmod($videosFile, 0666);
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

echo json_encode($response, JSON_PRETTY_PRINT);
