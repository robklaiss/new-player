<?php
header('Content-Type: application/json');

// Define the video directory
$videoDir = '/var/www/kiosk/videos/';

// Ensure the directory exists and is writable
if (!file_exists($videoDir)) {
    mkdir($videoDir, 0755, true);
}

if (!isset($_FILES['video'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No video file received']);
    exit;
}

$file = $_FILES['video'];
$targetPath = $videoDir . basename($file['name']);

// Try to save the uploaded file
if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    // Set proper permissions
    chmod($targetPath, 0644);
    echo json_encode(['success' => true, 'path' => $targetPath]);
} else {
    http_response_code(500);
    echo json_encode([
        'error' => 'Failed to save video',
        'details' => error_get_last()
    ]);
}