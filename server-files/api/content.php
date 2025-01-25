<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

// Get the latest video from the videos directory
$videos_dir = __DIR__ . '/../videos/';
$videos = glob($videos_dir . '*.mp4');

if (empty($videos)) {
    echo json_encode([
        'error' => 'No videos available'
    ]);
    exit;
}

// Get the most recently modified video
$latest_video = array_reduce($videos, function($latest, $video) {
    if (!$latest || filemtime($video) > filemtime($latest)) {
        return $video;
    }
    return $latest;
});

$video_url = 'https://vinculo.com.py/new-player/videos/' . basename($latest_video);

echo json_encode([
    'version' => time(),
    'content' => [
        'video' => $video_url
    ]
]);
