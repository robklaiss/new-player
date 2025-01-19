<?php
require_once 'config.php';
header('Content-Type: application/json');

try {
    verify_api_key();
    
    // Read devices file
    $devices = json_decode(file_get_contents(DEVICES_FILE), true);
    
    // Calculate status for each device
    foreach ($devices['devices'] as &$device) {
        // Consider device offline if not seen in last 5 minutes
        $device['status'] = (time() - $device['last_seen']) < 300 ? 'online' : 'offline';
    }
    
    echo json_encode($devices);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    
    log_event('error', [
        'type' => 'devices_list',
        'message' => $e->getMessage()
    ]);
}
