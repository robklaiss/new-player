<?php
header('Content-Type: application/json');

// Receive device status update
$input = json_decode(file_get_contents('php://input'), true);
$device_id = isset($input['device_id']) ? $input['device_id'] : '';
$status = isset($input['status']) ? $input['status'] : '';

// Log the update
$log_file = 'device_logs.txt';
$log_entry = date('Y-m-d H:i:s') . " - Device: $device_id - Status: $status\n";
file_put_contents($log_file, $log_entry, FILE_APPEND);

// Send response
echo json_encode(['status' => 'ok']);
