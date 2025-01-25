<?php
require_once 'config.php';

// Allow from any origin
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: X-Device-Id, X-API-Key');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json');

try {
    verify_api_key();
    
    // Get device info from request
    $headers = getallheaders();
    $device_id = isset($headers['X-Device-Id']) ? $headers['X-Device-Id'] : '';
    
    if (empty($device_id)) {
        throw new Exception('Device ID is required');
    }
    
    // Create content manifest with the specific video we want
    $manifest = [
        'version' => time(),
        'content' => [
            'video' => BASE_URL . '/api/videos/verano-ensalada-cesar-opt-ok.mp4'
        ]
    ];
    
    echo json_encode($manifest);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
