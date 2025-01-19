<?php
require_once 'log.php';
header('Content-Type: application/json');

$response = ['success' => false, 'error' => null];

try {
    log_event('delete_request', ['ip' => $_SERVER['REMOTE_ADDR']]);

    // Get filename from POST data
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['filename'])) {
        throw new Exception('Filename not provided');
    }
    
    $filename = $data['filename'];
    $filepath = '../videos/' . basename($filename); // Ensure the path is safe
    
    if (!file_exists($filepath)) {
        throw new Exception('Video file not found');
    }

    // Get file info before deletion for logging
    $fileInfo = [
        'size' => filesize($filepath),
        'modified' => filemtime($filepath)
    ];
    
    // Delete the file
    if (!unlink($filepath)) {
        throw new Exception('Failed to delete video file');
    }
    
    $response['success'] = true;

    log_event('delete_success', [
        'filename' => $filename,
        'file_info' => $fileInfo
    ]);

} catch (Exception $e) {
    http_response_code(500);
    $response['error'] = $e->getMessage();
    log_event('delete_error', [
        'error' => $e->getMessage(),
        'filename' => isset($data['filename']) ? $data['filename'] : 'not_provided'
    ]);
}

echo json_encode($response);
