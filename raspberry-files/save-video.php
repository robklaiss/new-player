<?php
// Force error reporting at the start
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// Set custom error log
ini_set('error_log', '/var/log/kiosk-video.log');

header('Content-Type: application/json');

// Define the video directory
$videoDir = '/var/www/kiosk/videos/';

// Function to log messages
function logMessage($message) {
    $timestamp = date('Y-m-d H:i:s');
    error_log("[KIOSK_VIDEO] $message");
    file_put_contents('/var/log/kiosk-video.log', "[$timestamp] $message\n", FILE_APPEND);
}

// Log script start
logMessage("=== Video upload script started ===");
logMessage("POST data size: " . (isset($_SERVER['CONTENT_LENGTH']) ? $_SERVER['CONTENT_LENGTH'] : 'unknown'));
logMessage("Files received: " . print_r($_FILES, true));

// Check directory exists and permissions
if (!file_exists($videoDir)) {
    logMessage("Creating video directory: $videoDir");
    if (!mkdir($videoDir, 0755, true)) {
        $error = error_get_last();
        logMessage("Failed to create directory: " . $error['message']);
        http_response_code(500);
        die(json_encode(['success' => false, 'error' => 'Failed to create video directory']));
    }
}

// Ensure directory is writable
if (!is_writable($videoDir)) {
    logMessage("Fixing directory permissions");
    if (!chmod($videoDir, 0755)) {
        logMessage("Failed to chmod directory");
    }
    if (!chown($videoDir, 'www-data')) {
        logMessage("Failed to chown directory");
    }
}

// Log directory status
logMessage("Directory permissions: " . substr(sprintf('%o', fileperms($videoDir)), -4));
logMessage("Directory owner: " . posix_getpwuid(fileowner($videoDir))['name']);

if (!isset($_FILES['video'])) {
    logMessage("No video file received");
    http_response_code(400);
    die(json_encode(['success' => false, 'error' => 'No video file received']));
}

$file = $_FILES['video'];
logMessage("Received file: " . print_r($file, true));

if ($file['error'] !== UPLOAD_ERR_OK) {
    $uploadErrors = [
        UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
        UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
        UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
        UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the file upload'
    ];
    $errorMessage = isset($uploadErrors[$file['error']]) ? $uploadErrors[$file['error']] : 'Unknown upload error';
    logMessage("Upload error: " . $errorMessage);
    http_response_code(400);
    die(json_encode(['success' => false, 'error' => $errorMessage]));
}

$targetPath = $videoDir . basename($file['name']);
logMessage("Moving file to: " . $targetPath);

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    chmod($targetPath, 0644);
    $filesize = filesize($targetPath);
    logMessage("File saved successfully. Size: " . $filesize . " bytes");
    echo json_encode(['success' => true, 'path' => $targetPath, 'size' => $filesize]);
} else {
    $error = error_get_last();
    logMessage("Failed to move uploaded file: " . $error['message']);
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save file']);
}