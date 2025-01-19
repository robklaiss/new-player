<?php
require_once 'log.php';
header('Content-Type: application/json');

$response = ['success' => false, 'videos' => [], 'error' => null];

try {
    log_event('videos_list_request', ['ip' => $_SERVER['REMOTE_ADDR']]);

    $videosDir = '../videos';
    $videos = [];
    
    if (is_dir($videosDir)) {
        $files = scandir($videosDir);
        foreach ($files as $file) {
            if ($file !== '.' && $file !== '..' && !is_dir($videosDir . '/' . $file)) {
                $filePath = $videosDir . '/' . $file;
                $videos[] = [
                    'name' => $file,
                    'size' => filesize($filePath),
                    'modified' => filemtime($filePath)
                ];
            }
        }
    }
    
    $response['success'] = true;
    $response['videos'] = $videos;

    log_event('videos_list_success', [
        'count' => count($videos),
        'total_size' => array_sum(array_column($videos, 'size'))
    ]);

} catch (Exception $e) {
    http_response_code(500);
    $response['error'] = $e->getMessage();
    log_event('videos_list_error', [
        'error' => $e->getMessage()
    ]);
}

echo json_encode($response);
