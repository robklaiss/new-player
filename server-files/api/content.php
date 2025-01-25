<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Range');
header('Access-Control-Expose-Headers: Content-Length, Content-Range, Content-Type');
header('Content-Type: application/json');

// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Get all videos from the videos directory
$videos_dir = __DIR__ . '/../videos/';
$video_list = [];
$base_url = 'https://vinculo.com.py/new-player/videos/';

// Debug info
$debug = [
    'directory' => $videos_dir,
    'exists' => is_dir($videos_dir),
    'readable' => is_readable($videos_dir),
    'errors' => []
];

if (is_dir($videos_dir) && is_readable($videos_dir)) {
    // Get all MP4 files
    $videos = glob($videos_dir . '*.mp4');
    
    foreach ($videos as $video) {
        $filename = basename($video);
        $full_url = $base_url . $filename;
        
        // Comprehensive file validation
        if (!file_exists($video)) {
            $debug['errors'][] = "File not found: $filename";
            continue;
        }
        
        if (!is_readable($video)) {
            $debug['errors'][] = "File not readable: $filename";
            continue;
        }
        
        $size = filesize($video);
        if ($size <= 0) {
            $debug['errors'][] = "Invalid file size: $filename";
            continue;
        }
        
        // Verify it's a valid MP4 file
        $handle = fopen($video, 'rb');
        if (!$handle) {
            $debug['errors'][] = "Cannot open file: $filename";
            continue;
        }
        
        $header = fread($handle, 8);
        fclose($handle);
        
        // Check for MP4 file signature (ftyp)
        if (strpos($header, 'ftyp') === false) {
            $debug['errors'][] = "Invalid MP4 format: $filename";
            continue;
        }
        
        // Get video duration if possible
        $duration = 0;
        if (function_exists('shell_exec')) {
            $duration_cmd = "ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 " . escapeshellarg($video);
            $duration = floatval(shell_exec($duration_cmd));
        }
        
        // Add valid video to list
        $video_list[] = [
            'url' => $full_url,
            'filename' => $filename,
            'modified' => filemtime($video),
            'size' => $size,
            'type' => 'video/mp4',
            'duration' => $duration,
            'status' => 'ready'
        ];
    }
    
    // Sort by modified time, newest first
    usort($video_list, function($a, $b) {
        return $b['modified'] - $a['modified'];
    });
}

$debug['files_found'] = count($video_list);
$debug['valid_files'] = array_map(function($v) { return $v['filename']; }, $video_list);

echo json_encode([
    'version' => time(),
    'content' => [
        'videos' => $video_list
    ],
    'debug' => $debug
], JSON_PRETTY_PRINT);
