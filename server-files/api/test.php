<?php
header('Content-Type: application/json');

// Basic test response
$response = [
    'status' => 'ok',
    'php_version' => PHP_VERSION,
    'server_time' => date('Y-m-d H:i:s'),
    'test' => true
];

echo json_encode($response);
