<?php
// Base configuration
define('BASE_URL', 'https://vinculo.com.py/new-player');
define('API_KEY', 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK');

// Helper functions
function verify_api_key() {
    $headers = getallheaders();
    $api_key = '';
    
    if (isset($headers['X-API-Key'])) {
        $api_key = $headers['X-API-Key'];
    } elseif (isset($headers['HTTP_X_API_KEY'])) {
        $api_key = $headers['HTTP_X_API_KEY'];
    } elseif (isset($_GET['key'])) {
        $api_key = $_GET['key'];
    }
    
    if ($api_key !== API_KEY) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid API key']);
        exit;
    }
}
