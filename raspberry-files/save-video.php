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

if (!isset($_FILES['video'])) {
    logMessage("No video file received in request");
    http_response_code(400);
    echo json_encode(['error' => 'No video file received']);
    exit;
}

$file = $_FILES['video'];
$targetPath = $videoDir . basename($file['name']);

logMessage("Attempting to save video: " . $file['name'] . " (size: " . $file['size'] . " bytes)");

// Try to save the uploaded file
if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    // Set proper permissions
    chmod($targetPath, 0644);
    logMessage("Successfully saved video: " . $file['name']);
    echo json_encode([
        'success' => true,
        'path' => $targetPath,
        'size' => filesize($targetPath)
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