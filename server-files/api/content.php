<?php
require_once 'config.php';
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
            'video' => BASE_URL . '/videos/verano-ensalada-cesar-opt2-ok.mp4'
        ]
    ];
    
    // Update device info
    update_device_info($device_id, [
        'last_content_check' => time(),
        'ip' => $_SERVER['REMOTE_ADDR']
    ]);
    
    // Log the content request
    log_event('content_request', [
        'device_id' => $device_id,
        'video' => 'verano-ensalada-cesar-opt2-ok.mp4'
    ]);
    
    echo json_encode($manifest);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    
    log_event('error', [
        'type' => 'content_request',
        'message' => $e->getMessage()
    ]);
}
