<?php
header('Content-Type: application/json');

$videoDir = '/var/www/kiosk/videos/';
$videos = [];

if (is_dir($videoDir)) {
    $files = scandir($videoDir);
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..' && is_file($videoDir . $file)) {
            $videos[] = $file;
        }
    }
}

echo json_encode($videos);