<?php
require_once 'log.php';
header('Content-Type: application/json');

$response = ['success' => false, 'devices' => [], 'error' => null];

try {
    $devicesFile = '../data/devices.json';
    
    // Handle pairing request
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (isset($input['action']) && $input['action'] === 'pair' && isset($input['device_id'])) {
            log_event('device_pair_request', [
                'ip' => $_SERVER['REMOTE_ADDR'],
                'device_id' => $input['device_id']
            ]);
            
            $deviceId = trim($input['device_id']);
            $devices = [];
            
            if (file_exists($devicesFile)) {
                $data = json_decode(file_get_contents($devicesFile), true);
                $devices = $data['devices'] ?? [];
            }
            
            // Add or update device
            $devices[$deviceId] = [
                'name' => $input['name'] ?? "Device " . substr($deviceId, -8),
                'paired' => true,
                'last_seen' => time(),
                'paired_at' => time(),
                'paired_by' => $_SERVER['REMOTE_ADDR']
            ];
            
            // Save updated devices
            file_put_contents($devicesFile, json_encode(['devices' => $devices], JSON_PRETTY_PRINT));
            
            $response['success'] = true;
            $response['message'] = 'Device paired successfully';
            log_event('device_pair_success', ['device_id' => $deviceId]);
        }
    } 
    // Handle GET request - list devices
    else {
        log_event('devices_list_request', ['ip' => $_SERVER['REMOTE_ADDR']]);
        
        if (file_exists($devicesFile)) {
            $data = json_decode(file_get_contents($devicesFile), true);
            $devices = [];
            
            foreach ($data['devices'] as $id => $device) {
                $device['id'] = $id;
                $device['status'] = (time() - $device['last_seen']) < 300 ? 'online' : 'offline';
                $devices[] = $device;
            }
            
            $response['devices'] = $devices;
        }
        
        $response['success'] = true;
        
        log_event('devices_list_success', [
            'count' => count($response['devices']),
            'online_count' => count(array_filter($response['devices'], function($d) { 
                return $d['status'] === 'online'; 
            }))
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    $response['error'] = $e->getMessage();
    log_event('devices_error', [
        'error' => $e->getMessage()
    ]);
}

echo json_encode($response);
