<?php
header('Content-Type: application/json');

try {
    $videosFile = '../data/videos.json';
    if (!file_exists($videosFile)) {
        throw new Exception('Videos file not found');
    }

    $videos = json_decode(file_get_contents($videosFile), true);
    if (!isset($videos['videos'])) {
        $videos = ['videos' => []];
    }

    // Get video details
    $videoList = [];
    foreach ($videos['videos'] as $filename) {
        $path = '../videos/' . $filename;
        if (file_exists($path)) {
            $videoList[] = [
                'filename' => $filename,
                'size' => filesize($path),
                'modified' => filemtime($path),
                'url' => '../videos/' . $filename
            ];
        }
    }

    echo json_encode([
        'success' => true,
        'videos' => $videoList
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
