<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

// Check for API key
$headers = getallheaders();
$api_key = isset($headers['X-API-Key']) ? $headers['X-API-Key'] : '';

if ($api_key !== 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK') {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid API key']);
    exit;
}

// Get POST data
$data = json_decode(file_get_contents('php://input'), true);

// Log status update
$log_file = '../logs/status.log';
if (!file_exists(dirname($log_file))) {
    mkdir(dirname($log_file), 0755, true);
}
file_put_contents($log_file, date('Y-m-d H:i:s') . ' - ' . json_encode($data) . "\n", FILE_APPEND);

$response = [
    'status' => 'ok',
    'timestamp' => time(),
    'message' => 'Status updated successfully'
];

echo json_encode($response);