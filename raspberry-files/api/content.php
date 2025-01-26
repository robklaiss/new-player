<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

// Check for API key
$headers = getallheaders();
$api_key = isset($headers['X-API-Key']) ? $headers['X-API-Key'] : '';

if ($api_key !== 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK') {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid API key']);
    exit;
}

// Get the current video file
$video_file = '../optimized.mp4';
$video_url = '/optimized.mp4';

$response = [
    'status' => 'ok',
    'video_url' => $video_url,
    'timestamp' => time(),
    'config' => [
        'autoplay' => true,
        'loop' => true,
        'volume' => 1.0
    ]
];

// Check if video file exists
if (!file_exists($video_file)) {
    $response['status'] = 'error';
    $response['message'] = 'Video file not found';
    http_response_code(404);
}

echo json_encode($response);