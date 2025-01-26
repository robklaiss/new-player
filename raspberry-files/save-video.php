<?php
header('Content-Type: application/json');

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Define the video directory
$videoDir = '/var/www/kiosk/videos/';

// Function to log messages
function logMessage($message) {
    error_log("[" . date('Y-m-d H:i:s') . "] " . $message . "\n", 3, "/var/log/kiosk-video.log");
}

// Function to check directory permissions
function checkAndFixPermissions($dir) {
    if (!is_writable($dir)) {
        logMessage("Directory not writable: $dir");
        if (!chmod($dir, 0755)) {
            logMessage("Failed to chmod directory: $dir");
            return false;
        }
        if (!chown($dir, 'www-data')) {
            logMessage("Failed to chown directory: $dir");
            return false;
        }
    }
    return true;
}

// Ensure the directory exists and is writable
if (!file_exists($videoDir)) {
    logMessage("Creating video directory: $videoDir");
    if (!mkdir($videoDir, 0755, true)) {
        $error = error_get_last();
        logMessage("Failed to create directory: " . $error['message']);
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create video directory', 'details' => $error]);
        exit;
    }
}

// Check and fix permissions
if (!checkAndFixPermissions($videoDir)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to set directory permissions']);
    exit;
}

if (!isset($_FILES['video'])) {
    logMessage("No video file received in request");
    http_response_code(400);
    echo json_encode(['error' => 'No video file received']);
    exit;
}

$file = $_FILES['video'];
$targetPath = $videoDir . basename($file['name']);

logMessage("Attempting to save video: " . $file['name'] . " (size: " . $file['size'] . " bytes)");

// Verify upload
if ($file['error'] !== UPLOAD_ERR_OK) {
    $uploadErrors = array(
        UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
        UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
        UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
        UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the file upload'
    );
    $errorMessage = isset($uploadErrors[$file['error']]) ? $uploadErrors[$file['error']] : 'Unknown upload error';
    logMessage("Upload error: " . $errorMessage);
    http_response_code(500);
    echo json_encode(['error' => $errorMessage]);
    exit;
}

// Try to save the uploaded file
if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    // Set proper permissions
    chmod($targetPath, 0644);
    chown($targetPath, 'www-data');
    
    // Verify the file was saved correctly
    if (!file_exists($targetPath)) {
        logMessage("File doesn't exist after move: " . $targetPath);
        http_response_code(500);
        echo json_encode(['error' => 'File not found after move']);
        exit;
    }
    
    $savedSize = filesize($targetPath);
    if ($savedSize === false || $savedSize === 0) {
        logMessage("File size is 0 or false: " . $targetPath);
        http_response_code(500);
        echo json_encode(['error' => 'File size is 0 or cannot be determined']);
        exit;
    }
    
    logMessage("Successfully saved video: " . $file['name'] . " (saved size: " . $savedSize . " bytes)");
    echo json_encode([
        'success' => true,
        'path' => $targetPath,
        'size' => $savedSize
    ]);
} else {
    $error = error_get_last();
    logMessage("Failed to save video: " . $error['message']);
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to save video',
        'details' => $error,
        'file_info' => [
            'name' => $file['name'],
            'size' => $file['size'],
            'tmp_name' => $file['tmp_name'],
            'error' => $file['error']
        ]
    ]);
}