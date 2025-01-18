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
    
    // Get status update from request body
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['status'])) {
        throw new Exception('Invalid status update format');
    }
    
    // Update device info
    update_device_info($device_id, [
        'last_update' => time(),
        'status' => $input['status'],
        'ip' => $_SERVER['REMOTE_ADDR'],
        'version' => isset($input['version']) ? $input['version'] : null,
        'current_video' => isset($input['current_video']) ? $input['current_video'] : null,
        'errors' => isset($input['errors']) ? $input['errors'] : null
    ]);
    
    // Log the update
    log_event('status_update', [
        'device_id' => $device_id,
        'status' => $input['status'],
        'data' => $input
    ]);
    
    // Send response with any commands for the device
    $response = ['status' => 'ok'];
    
    // Check if we need to send any commands
    $device_info = get_device_info($device_id);
    if (isset($device_info['pending_commands']) && !empty($device_info['pending_commands'])) {
        $response['commands'] = $device_info['pending_commands'];
        
        // Clear pending commands
        update_device_info($device_id, ['pending_commands' => []]);
    }
    
    echo json_encode($response);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    
    log_event('error', [
        'type' => 'status_update',
        'message' => $e->getMessage()
    ]);
}
