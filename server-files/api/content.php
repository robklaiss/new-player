<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Get all videos from the videos directory
$videos_dir = __DIR__ . '/../videos/';
$videos = glob($videos_dir . '*.mp4');
$video_list = [];

// Debug info
$debug = [
    'directory' => $videos_dir,
    'exists' => is_dir($videos_dir),
    'readable' => is_readable($videos_dir),
    'files_found' => count($videos)
];

foreach ($videos as $video) {
    $video_list[] = [
        'url' => 'https://vinculo.com.py/new-player/videos/' . basename($video),
        'filename' => basename($video),
        'modified' => filemtime($video)
    ];
}

// Sort by modified time, newest first
usort($video_list, function($a, $b) {
    return $b['modified'] - $a['modified'];
});

echo json_encode([
    'version' => time(),
    'content' => [
        'videos' => $video_list
    ],
    'debug' => $debug
]);
