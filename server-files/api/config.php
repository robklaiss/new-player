<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Base configuration
define('BASE_URL', 'https://vinculo.com.py/new-player');
define('API_KEY', 'w8oMou6uUiUQBE4fvoPamvdKjOwSCNBK');  // Secure generated key
define('VIDEOS_DIR', dirname(__DIR__) . '/videos/');  // Changed to look in parent directory
define('LOGS_DIR', __DIR__ . '/logs/');
define('DEVICES_FILE', __DIR__ . '/data/devices.json');
define('ROTATION_FILE', __DIR__ . '/data/rotation.json');

// Create required directories
$dirs = [VIDEOS_DIR, LOGS_DIR, dirname(DEVICES_FILE)];
foreach ($dirs as $dir) {
    if (!file_exists($dir)) {
        mkdir($dir, 0755, true);
    }
}

// Initialize files if they don't exist
if (!file_exists(DEVICES_FILE)) {
    file_put_contents(DEVICES_FILE, json_encode(['devices' => []]));
}
if (!file_exists(ROTATION_FILE)) {
    file_put_contents(ROTATION_FILE, json_encode([
        'mode' => 'sequential',  // sequential or random
        'interval' => 86400,     // rotation interval in seconds (24 hours)
        'last_rotation' => time()
    ]));
}

// Helper functions
function verify_api_key() {
    $headers = getallheaders();
    $api_key = '';
    
    // Try different methods to get the API key
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

function get_device_info($device_id) {
    $devices = json_decode(file_get_contents(DEVICES_FILE), true);
    return $devices['devices'][$device_id] ?? null;
}

function update_device_info($device_id, $info) {
    $devices = json_decode(file_get_contents(DEVICES_FILE), true);
    if (!isset($devices['devices'][$device_id])) {
        $devices['devices'][$device_id] = [];
    }
    $devices['devices'][$device_id] = array_merge($devices['devices'][$device_id], $info);
    file_put_contents(DEVICES_FILE, json_encode($devices, JSON_PRETTY_PRINT));
}

function get_current_video() {
    $rotation = json_decode(file_get_contents(ROTATION_FILE), true);
    $videos = array_filter(scandir(VIDEOS_DIR), function($file) {
        return pathinfo($file, PATHINFO_EXTENSION) === 'mp4';
    });
    
    if (empty($videos)) {
        return null;
    }
    
    // Check if we need to rotate
    if (time() - $rotation['last_rotation'] >= $rotation['interval']) {
        if ($rotation['mode'] === 'random') {
            $rotation['current_video'] = $videos[array_rand($videos)];
        } else {
            $current_index = array_search($rotation['current_video'] ?? '', $videos);
            $next_index = ($current_index === false || $current_index >= count($videos) - 1) ? 0 : $current_index + 1;
            $rotation['current_video'] = $videos[$next_index];
        }
        $rotation['last_rotation'] = time();
        file_put_contents(ROTATION_FILE, json_encode($rotation, JSON_PRETTY_PRINT));
    }
    
    return $rotation['current_video'] ?? reset($videos);
}

function log_event($event_type, $data) {
    $log_entry = [
        'timestamp' => time(),
        'type' => $event_type,
        'data' => $data
    ];
    
    $log_file = LOGS_DIR . date('Y-m-d') . '.log';
    file_put_contents($log_file, json_encode($log_entry) . "\n", FILE_APPEND);
}
