<?php
header('Content-Type: application/json');

$response = ['success' => false, 'error' => null];

try {
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
    
    // Delete the file
    if (!unlink($filepath)) {
        throw new Exception('Failed to delete video file');
    }
    
    $response['success'] = true;

} catch (Exception $e) {
    http_response_code(500);
    $response['error'] = $e->getMessage();
}

echo json_encode($response);
