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

// Debug info
$debug = [
    'directory' => $videos_dir,
    'exists' => is_dir($videos_dir),
    'readable' => is_readable($videos_dir)
];

if (is_dir($videos_dir) && is_readable($videos_dir)) {
    // Get all MP4 files
    $videos = glob($videos_dir . '*.mp4');
    
    foreach ($videos as $video) {
        // Only add videos that exist, are readable, and not empty
        if (file_exists($video) && is_readable($video) && filesize($video) > 0) {
            $size = filesize($video);
            $filename = basename($video);
            
            // Verify it's a valid MP4 file by checking the first few bytes
            $handle = fopen($video, 'rb');
            $header = fread($handle, 8);
            fclose($handle);
            
            // Check for MP4 file signature (ftyp)
            if (strpos($header, 'ftyp') !== false) {
                $video_list[] = [
                    'url' => 'https://vinculo.com.py/new-player/videos/' . $filename,
                    'filename' => $filename,
                    'modified' => filemtime($video),
                    'size' => $size,
                    'type' => 'video/mp4'
                ];
            }
        }
    }
    
    // Sort by modified time, newest first
    usort($video_list, function($a, $b) {
        return $b['modified'] - $a['modified'];
    });
}

$debug['files_found'] = count($video_list);
$debug['files'] = array_map(function($v) { return $v['filename']; }, $video_list);

echo json_encode([
    'version' => time(),
    'content' => [
        'videos' => $video_list
    ],
    'debug' => $debug
]);
