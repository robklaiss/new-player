<?php
require_once 'config.php';
header('Content-Type: application/json');

try {
    verify_api_key();
    
    // Get device info from request
    $headers = getallheaders();
    $device_id = isset($headers['X-Device-Id']) ? $headers['X-Device-Id'] : '';
    
    // Check server configuration
    $config_test = [
        'videos_dir_exists' => is_dir(VIDEOS_DIR),
        'videos_dir_writable' => is_writable(VIDEOS_DIR),
        'logs_dir_exists' => is_dir(LOGS_DIR),
        'logs_dir_writable' => is_writable(LOGS_DIR),
        'devices_file_exists' => file_exists(DEVICES_FILE),
        'devices_file_writable' => is_writable(dirname(DEVICES_FILE)),
        'rotation_file_exists' => file_exists(ROTATION_FILE),
        'rotation_file_writable' => is_writable(dirname(ROTATION_FILE))
    ];
    
    // Get list of videos
    $videos = array_filter(scandir(VIDEOS_DIR), function($file) {
        return pathinfo($file, PATHINFO_EXTENSION) === 'mp4';
    });
    
    // Basic test response
    $response = [
        'status' => 'ok',
        'timestamp' => time(),
        'datetime' => date('Y-m-d H:i:s'),
        'php_version' => PHP_VERSION,
        'server_software' => $_SERVER['SERVER_SOFTWARE'],
        'config_test' => $config_test,
        'videos_count' => count($videos),
        'videos' => $videos,
        'device_id' => $device_id
    ];
    
    if ($device_id) {
        $response['device_info'] = get_device_info($device_id);
    }
    
    // Log the test request
    log_event('test_request', [
        'device_id' => $device_id,
        'config_test' => $config_test
    ]);
    
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    
    log_event('error', [
        'type' => 'test_request',
        'message' => $e->getMessage()
    ]);
}
