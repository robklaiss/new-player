<?php
// Force error reporting at the start
ini_set('display_errors', 1);
ini_set('log_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');

// Define the video directory
$videoDir = '/var/www/kiosk/videos/';

// Function to log messages
function logMessage($message) {
    $timestamp = date('Y-m-d H:i:s');
    // Log directly to Apache error log
    error_log("[KIOSK_VIDEO] $message");
    // Also try custom log file
    @error_log("[$timestamp] $message\n", 3, "/var/log/kiosk-video.log");
}

// Log script start and request details
logMessage("=== Video upload script started ===");
logMessage("REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);
logMessage("CONTENT_TYPE: " . $_SERVER['CONTENT_TYPE']);
logMessage("CONTENT_LENGTH: " . $_SERVER['CONTENT_LENGTH']);
logMessage("POST data: " . print_r($_POST, true));
logMessage("FILES data: " . print_r($_FILES, true));

// Function to check directory permissions
function checkAndFixPermissions($dir) {
    logMessage("Checking permissions for directory: $dir");
    logMessage("Current permissions: " . substr(sprintf('%o', fileperms($dir)), -4));
    logMessage("Current owner: " . posix_getpwuid(fileowner($dir))['name']);
    
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
        logMessage("Failed to create directory: " . print_r($error, true));
        http_response_code(500);
        echo json_encode(['error' => 'Failed to create video directory', 'details' => $error]);
        exit;
    }
}

// Check and fix permissions
if (!checkAndFixPermissions($videoDir)) {
    logMessage("Failed to set directory permissions for: $videoDir");
    http_response_code(500);
    echo json_encode(['error' => 'Failed to set directory permissions']);
    exit;
}

if (!isset($_FILES['video'])) {
    logMessage("No video file received in request");
    logMessage("POST data: " . print_r($_POST, true));
    logMessage("FILES array: " . print_r($_FILES, true));
    http_response_code(400);
    echo json_encode(['error' => 'No video file received']);
    exit;
}

$file = $_FILES['video'];
$targetPath = $videoDir . basename($file['name']);

logMessage("File upload details: " . print_r($file, true));
logMessage("Target path: $targetPath");

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
logMessage("Moving uploaded file from {$file['tmp_name']} to {$targetPath}");
if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    // Set proper permissions
    chmod($targetPath, 0644);
    chown($targetPath, 'www-data');
    
    // Verify the file was saved correctly
    if (!file_exists($targetPath)) {
        logMessage("File doesn't exist after move: $targetPath");
        http_response_code(500);
        echo json_encode(['error' => 'File not found after move']);
        exit;
    }
    
    $savedSize = filesize($targetPath);
    logMessage("Saved file size: $savedSize bytes");
    
    if ($savedSize === false || $savedSize === 0) {
        logMessage("File size is 0 or false: $targetPath");
        http_response_code(500);
        echo json_encode(['error' => 'File size is 0 or cannot be determined']);
        exit;
    }
    
    logMessage("Successfully saved video: {$file['name']} (saved size: $savedSize bytes)");
    echo json_encode([
        'success' => true,
        'path' => $targetPath,
        'size' => $savedSize
    ]);
} else {
    $error = error_get_last();
    logMessage("Failed to move uploaded file. Error: " . print_r($error, true));
    logMessage("Temp file exists: " . (file_exists($file['tmp_name']) ? 'yes' : 'no'));
    logMessage("Temp file readable: " . (is_readable($file['tmp_name']) ? 'yes' : 'no'));
    logMessage("Target dir writable: " . (is_writable(dirname($targetPath)) ? 'yes' : 'no'));
    
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

logMessage("=== Video upload script finished ===");