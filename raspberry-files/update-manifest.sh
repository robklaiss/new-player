#!/bin/bash

# Directory containing the files
KIOSK_DIR="/var/www/kiosk"
MANIFEST_FILE="$KIOSK_DIR/update.json"

# Function to calculate file hash
calculate_hash() {
    md5sum "$1" | cut -d' ' -f1
}

# Function to update manifest
update_manifest() {
    # Get current timestamp
    timestamp=$(date -Iseconds)
    
    # Start JSON structure
    echo "{" > "$MANIFEST_FILE"
    echo "  \"version\": \"1.0.$(date +%Y%m%d%H%M%S)\"," >> "$MANIFEST_FILE"
    echo "  \"lastUpdated\": \"$timestamp\"," >> "$MANIFEST_FILE"
    echo "  \"files\": {" >> "$MANIFEST_FILE"
    
    # Add video.mp4 if it exists
    if [ -f "$KIOSK_DIR/video.mp4" ]; then
        hash=$(calculate_hash "$KIOSK_DIR/video.mp4")
        echo "    \"video.mp4\": {" >> "$MANIFEST_FILE"
        echo "      \"version\": \"1.0.0\"," >> "$MANIFEST_FILE"
        echo "      \"hash\": \"$hash\"" >> "$MANIFEST_FILE"
        echo "    }," >> "$MANIFEST_FILE"
    fi
    
    # Add index.html
    hash=$(calculate_hash "$KIOSK_DIR/index.html")
    echo "    \"index.html\": {" >> "$MANIFEST_FILE"
    echo "      \"version\": \"1.0.0\"," >> "$MANIFEST_FILE"
    echo "      \"hash\": \"$hash\"" >> "$MANIFEST_FILE"
    echo "    }" >> "$MANIFEST_FILE"
    
    # Close JSON structure
    echo "  }" >> "$MANIFEST_FILE"
    echo "}" >> "$MANIFEST_FILE"
    
    # Set proper permissions
    chown $USER:$USER "$MANIFEST_FILE"
    chmod 644 "$MANIFEST_FILE"
    
    echo "Manifest updated at $timestamp"
}

# Check if manifest directory exists
if [ ! -d "$KIOSK_DIR" ]; then
    echo "Error: Kiosk directory does not exist"
    exit 1
fi

# Update the manifest
update_manifest
