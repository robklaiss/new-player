<?php
header('Content-Type: application/json');

$response = ['success' => false, 'videos' => [], 'error' => null];

try {
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

} catch (Exception $e) {
    http_response_code(500);
    $response['error'] = $e->getMessage();
}

echo json_encode($response);
