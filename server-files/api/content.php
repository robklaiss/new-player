<?php
header('Content-Type: application/json');

// Configuration
$base_url = 'https://vinculo.com.py/new-player';
$videos_dir = __DIR__ . '/videos/';

// Get list of videos
$videos = array_filter(scandir($videos_dir), function($file) {
    return pathinfo($file, PATHINFO_EXTENSION) === 'mp4';
});

// Create content manifest
$manifest = [
    'version' => time(),  // Use timestamp as version
    'content' => [
        'video' => $base_url . '/api/videos/' . reset($videos)  // Get first video
    ]
];

echo json_encode($manifest);
