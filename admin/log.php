<?php
function log_event($type, $data) {
    $log_dir = '../logs';
    
    // Create logs directory if it doesn't exist
    if (!file_exists($log_dir)) {
        mkdir($log_dir, 0755, true);
    }
    
    $log_file = $log_dir . '/admin.log';
    $timestamp = date('Y-m-d H:i:s');
    $client_ip = $_SERVER['REMOTE_ADDR'];
    
    // Format log entry
    $log_entry = [
        'timestamp' => $timestamp,
        'ip' => $client_ip,
        'type' => $type,
        'data' => $data
    ];
    
    // Append to log file
    file_put_contents(
        $log_file, 
        json_encode($log_entry, JSON_UNESCAPED_SLASHES) . "\n", 
        FILE_APPEND
    );
}
