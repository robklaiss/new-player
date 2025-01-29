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

$videoDir = '/var/www/kiosk/videos/';
$filename = isset($_GET['filename']) ? basename($_GET['filename']) : '';

if (empty($filename)) {
    http_response_code(400);
    die(json_encode(['exists' => false, 'error' => 'No filename provided']));
}

$filepath = $videoDir . $filename;
$exists = file_exists($filepath);

// Log the check
error_log("[KIOSK_VIDEO] Checking file: $filename - " . ($exists ? "Found" : "Not found"));

echo json_encode([
    'exists' => $exists,
    'filename' => $filename,
    'size' => $exists ? filesize($filepath) : 0,
    'path' => $filepath
]);