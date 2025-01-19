<?php
require_once 'log.php';
header('Content-Type: application/json');

$response = ['success' => false, 'devices' => [], 'error' => null];

try {
    log_event('devices_list_request', ['ip' => $_SERVER['REMOTE_ADDR']]);

    $devicesFile = '../data/devices.json';
    
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

} catch (Exception $e) {
    http_response_code(500);
    $response['error'] = $e->getMessage();
    log_event('devices_list_error', [
        'error' => $e->getMessage()
    ]);
}

echo json_encode($response);
