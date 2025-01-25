<?php
require_once 'config.php';

// Allow from any origin
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: X-Device-Id, X-API-Key');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

header('Content-Type: application/json');

try {
    verify_api_key();
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        // Handle device registration/update
        $headers = getallheaders();
        $device_id = isset($headers['X-Device-Id']) ? $headers['X-Device-Id'] : '';
        
        if (empty($device_id)) {
            throw new Exception('Device ID is required');
        }
        
        // Read current devices
        $devices_file = __DIR__ . '/data/devices.json';
        $devices = [];
        
        if (file_exists($devices_file)) {
            $devices = json_decode(file_get_contents($devices_file), true);
        }
        
        if (!isset($devices['devices'])) {
            $devices['devices'] = [];
        }
        
        // Update or add device
        $found = false;
        foreach ($devices['devices'] as &$device) {
            if ($device['id'] === $device_id) {
                $device['last_seen'] = time();
                $device['status'] = 'online';
                $found = true;
                break;
            }
        }
        
        if (!$found) {
            $devices['devices'][] = [
                'id' => $device_id,
                'name' => 'Kiosk Verano 2025',
                'last_seen' => time(),
                'status' => 'online'
            ];
        }
        
        // Save devices file
        if (!file_exists(__DIR__ . '/data')) {
            mkdir(__DIR__ . '/data', 0755, true);
        }
        file_put_contents($devices_file, json_encode($devices, JSON_PRETTY_PRINT));
        
        echo json_encode(['success' => true, 'message' => 'Device registered']);
    } else {
        // Read devices file
        $devices_file = __DIR__ . '/data/devices.json';
        $devices = [];
        
        if (file_exists($devices_file)) {
            $devices = json_decode(file_get_contents($devices_file), true);
        }
        
        // Calculate status for each device
        if (isset($devices['devices'])) {
            foreach ($devices['devices'] as &$device) {
                // Consider device offline if not seen in last 5 minutes
                $device['status'] = (time() - $device['last_seen']) < 300 ? 'online' : 'offline';
            }
        }
        
        echo json_encode($devices);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    
    log_event('error', [
        'type' => 'devices_list',
        'message' => $e->getMessage()
    ]);
}
