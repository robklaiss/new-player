<?php
header('Content-Type: application/json');

$videoDir = '/var/www/kiosk/videos/';
$filename = isset($_GET['filename']) ? basename($_GET['filename']) : '';

if (empty($filename)) {
    die(json_encode(['exists' => false, 'error' => 'No filename provided']));
}

$filepath = $videoDir . $filename;
$exists = file_exists($filepath);

echo json_encode([
    'exists' => $exists,
    'filename' => $filename,
    'size' => $exists ? filesize($filepath) : 0
]);