<?php
header('Content-Type: application/json');

try {
    // Define absolute paths
    $videosDir = '/var/www/kiosk/videos';
    $dataDir = '/var/www/kiosk/data';
    $videosFile = $dataDir . '/videos.json';
    
    if (!file_exists($videosFile)) {
        throw new Exception('Videos file not found');
    }

    // Handle POST request for deletion
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['action']) || $input['action'] !== 'delete') {
            throw new Exception('Invalid action');
        }
        
        if (!isset($input['filename'])) {
            throw new Exception('Filename not provided');
        }
        
        $filename = $input['filename'];
        $videoPath = $videosDir . '/' . $filename;
        
        // Validate filename to prevent directory traversal
        if (strpos($filename, '/') !== false || strpos($filename, '\\') !== false) {
            throw new Exception('Invalid filename');
        }
        
        // Delete the file if it exists
        if (file_exists($videoPath)) {
            if (!unlink($videoPath)) {
                throw new Exception('Failed to delete video file');
            }
        }
        
        // Update videos.json
        $videos = json_decode(file_get_contents($videosFile), true);
        if (!isset($videos['videos'])) {
            $videos = ['videos' => []];
        }
        
        $videos['videos'] = array_values(array_diff($videos['videos'], [$filename]));
        
        if (!file_put_contents($videosFile, json_encode($videos, JSON_PRETTY_PRINT))) {
            throw new Exception('Failed to update videos.json');
        }
        
        echo json_encode(['success' => true]);
        exit;
    }

    // Handle GET request for listing videos
    $videos = json_decode(file_get_contents($videosFile), true);
    if (!isset($videos['videos'])) {
        $videos = ['videos' => []];
    }

    // Get video details
    $videoList = [];
    foreach ($videos['videos'] as $filename) {
        $path = $videosDir . '/' . $filename;
        if (file_exists($path)) {
            $videoList[] = [
                'filename' => $filename,
                'size' => filesize($path),
                'modified' => filemtime($path),
                'url' => '/kiosk/videos/' . $filename
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