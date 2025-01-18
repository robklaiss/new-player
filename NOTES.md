# Development Notes - January 18, 2025

## Progress Made Today

### 1. API Integration
- Created `config.php` for centralized settings
- Added API key authentication
- Implemented device status tracking
- Added video rotation logic
- Added command support (reload, refresh)

### 2. Frontend Updates
- Switched from Chrome to Firefox for better kiosk support
- Added PWA support with manifest.json
- Created service worker for offline caching
- Added error handling and recovery
- Added device status reporting

### 3. Firefox Configuration
- Created proper Firefox profile setup
- Enabled service workers and required settings
- Added profile persistence
- Improved kiosk mode stability

### 4. Documentation
- Updated README with Firefox setup instructions
- Added PWA setup steps
- Added troubleshooting guide
- Added server setup instructions

## Current Issues
1. Service worker not registering properly in Firefox
   - Added additional Firefox configuration
   - Need to test with new profile settings
   - May need to check HTTPS/localhost requirements

## Next Steps
1. Test service worker with new Firefox configuration
2. Verify offline caching works
3. Test video rotation
4. Test device status reporting
5. Test remote commands
6. Create deployment script for easy installation

## Latest Commits
1. "Improve Firefox profile setup and service worker configuration"
   - Enhanced Firefox profile settings
   - Better service worker support
   - Improved error handling

2. "Update README with Firefox and PWA setup instructions"
   - Added PWA documentation
   - Updated installation steps
   - Added troubleshooting guide

3. "Add PWA support with manifest and improved service worker registration"
   - Added manifest.json
   - Enhanced service worker registration
   - Added offline support

4. "Update frontend to work with new API and add device management"
   - Added API integration
   - Added device status reporting
   - Added video rotation support

## Files Changed
- `raspberry-files/index.html`
- `raspberry-files/service-worker.js`
- `raspberry-files/config.js`
- `raspberry-files/manifest.json`
- `raspberry-files/start-kiosk.sh`
- `raspberry-files/README.md`

## Test Environment
- Server: vinculo.com.py/new-player/api
- Local: http://localhost:8000
- Browser: Firefox ESR
- OS: Raspberry Pi OS
