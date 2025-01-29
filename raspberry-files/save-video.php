<?php
// Enable error reporting
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);
ini_set('error_log', '/var/log/kiosk-video.log');

// Set headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Define the video directory
$videoDir = '/var/www/kiosk/videos/';

// Function to log messages
function logMessage($message) {
    $timestamp = date('Y-m-d H:i:s');
    error_log("[KIOSK_VIDEO] $message");
}

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
    logMessage("Directory not writable, fixing permissions");
    chmod($videoDir, 0755);
    chown($videoDir, 'www-data');
}

logMessage("Request method: " . $_SERVER['REQUEST_METHOD']);
logMessage("Raw post: " . file_get_contents('php://input'));
logMessage("Files: " . print_r($_FILES, true));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['video'])) {
        logMessage("No video file received");
        http_response_code(400);
        die(json_encode(['success' => false, 'error' => 'No video file received']));
    }

    $file = $_FILES['video'];
    logMessage("Received file: " . print_r($file, true));

    if ($file['error'] !== UPLOAD_ERR_OK) {
        $error = match($file['error']) {
            UPLOAD_ERR_INI_SIZE => 'File exceeds upload_max_filesize',
            UPLOAD_ERR_FORM_SIZE => 'File exceeds MAX_FILE_SIZE',
            UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
            UPLOAD_ERR_NO_FILE => 'No file was uploaded',
            UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
            UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
            UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the file upload',
            default => 'Unknown upload error'
        };
        logMessage("Upload error: $error");
        http_response_code(400);
        die(json_encode(['success' => false, 'error' => $error]));
    }

    $targetPath = $videoDir . basename($file['name']);
    logMessage("Moving file to: $targetPath");

    if (move_uploaded_file($file['tmp_name'], $targetPath)) {
        chmod($targetPath, 0644);
        chown($targetPath, 'www-data');
        $filesize = filesize($targetPath);
        logMessage("File saved successfully. Size: $filesize bytes");
        echo json_encode(['success' => true, 'path' => $targetPath, 'size' => $filesize]);
    } else {
        $error = error_get_last();
        logMessage("Failed to move file: " . ($error ? $error['message'] : 'Unknown error'));
        logMessage("Temp file exists: " . (file_exists($file['tmp_name']) ? 'yes' : 'no'));
        logMessage("Target dir writable: " . (is_writable($videoDir) ? 'yes' : 'no'));
        http_response_code(500);
        die(json_encode(['success' => false, 'error' => 'Failed to save file']));
    }
} else {
    logMessage("Invalid request method: " . $_SERVER['REQUEST_METHOD']);
    http_response_code(405);
    die(json_encode(['success' => false, 'error' => 'Method not allowed']));
}