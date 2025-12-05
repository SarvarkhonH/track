# Background Location Tracking Implementation Guide

## Overview
This guide explains the background location tracking implementation for the Geo Tracker Android app.

## What Was Implemented

### 1. Background Location Task Service
**File:** `services/backgroundLocationTask.js`

This service defines a background task that runs even when the app is closed. It:
- Registers with `expo-task-manager` to handle location updates
- Queues location data to AsyncStorage for offline support
- Automatically syncs queued data when network is available
- Implements batch sending with retry logic
- Includes dead letter queue for failed sends

### 2. Updated Tracking Screen
**File:** `app/(app)/tracking.jsx`

The tracking screen now supports two modes:
- **Foreground Tracking**: Tracks location only when app is open
- **Background Tracking**: Tracks location even when app is closed or backgrounded

Features:
- Separate buttons for foreground and background tracking
- Shows current tracking status
- Displays queue size
- Manual flush and clear dead queue buttons

### 3. Android Configuration
**File:** `app.json`

Added required Android permissions:
- `ACCESS_COARSE_LOCATION` - Basic location access
- `ACCESS_FINE_LOCATION` - Precise location access
- `ACCESS_BACKGROUND_LOCATION` - Background location (Android 10+)
- `FOREGROUND_SERVICE` - Run service in foreground
- `FOREGROUND_SERVICE_LOCATION` - Location-specific foreground service
- `WAKE_LOCK` - Keep device awake for location updates
- `ACCESS_NETWORK_STATE` - Check network connectivity
- `INTERNET` - Send data to server

Added expo-location plugin configuration:
- Enabled background location for Android
- Enabled foreground service
- Configured permission messages

### 4. Task Registration
**File:** `app/_layout.jsx`

Imported the background task at the root level to ensure it's registered when the app starts.

## How Background Tracking Works

### Permission Flow
1. User clicks "Start Background Tracking"
2. App requests foreground location permission
3. If Android 10+ (API 29+), requests background location permission
4. User must select "Allow all the time" for background tracking to work

### Tracking Process
1. User starts background tracking
2. App stores tracking metadata (userId, shtabId) in AsyncStorage
3. Background task begins receiving location updates
4. Each location is queued to AsyncStorage
5. Background task attempts to send locations to server
6. If offline, locations remain queued
7. When online, queued locations are sent in batches

### Foreground Service
On Android 8+, a persistent notification shows:
- Title: "Geo Tracker Active"
- Body: "Tracking for {shtabName}"
- Color: Blue (#007AFF)

This notification CANNOT be dismissed while tracking is active. This is a requirement for background location tracking on Android.

## Testing Instructions

### Prerequisites
1. Physical Android device (background tracking doesn't work well on emulator)
2. Android version 8.0 (API 26) or higher
3. Backend server running and accessible from the device

### Build Steps
```bash
# Clean and rebuild
npm install

# For development build with Expo Dev Client
npx expo run:android

# OR for production build with EAS
eas build --platform android --profile preview
```

### Test Scenarios

#### Test 1: Foreground Tracking
1. Open the app
2. Select a shtab
3. Click "Start Foreground Tracking"
4. Grant location permissions
5. Move around
6. Verify locations are queued and sent
7. Click "Stop Foreground Tracking"

#### Test 2: Background Tracking - App Closed
1. Open the app
2. Click "Start Background Tracking"
3. Grant "Allow all the time" permission
4. Verify notification appears
5. **Close the app completely** (swipe away from recent apps)
6. Move around for 5-10 minutes
7. Reopen the app
8. Check queue size - should show accumulated locations

#### Test 3: Background Tracking - Airplane Mode
1. Start background tracking
2. Enable airplane mode
3. Move around
4. Locations should queue locally
5. Disable airplane mode
6. Locations should automatically sync to server

#### Test 4: Background Tracking - Screen Off
1. Start background tracking
2. Lock the device (screen off)
3. Leave device for 10-15 minutes while moving
4. Unlock device
5. Check app - locations should be tracked

### Expected Behavior

**When Tracking is Active:**
- Persistent notification visible
- Locations recorded every 5 seconds OR every 10 meters
- Locations queued locally
- Batch uploads to server when online
- Battery icon may show increased usage

**Queue Management:**
- Queue size shown in app
- Max queue: 2000 locations
- Batch size: 25 locations per upload
- Retry logic: 4 attempts with exponential backoff

**Permissions Required:**
- Android 8-9: "Allow" location permission
- Android 10+: "Allow all the time" location permission

## Troubleshooting

### Background Tracking Not Working

**Issue:** Locations not tracked when app is closed

**Solutions:**
1. Verify "Allow all the time" permission is granted
   - Settings > Apps > Geo Tracker > Permissions > Location > Allow all the time

2. Check battery optimization
   - Settings > Battery > Battery optimization
   - Find Geo Tracker
   - Set to "Don't optimize"

3. Check background restrictions
   - Settings > Apps > Geo Tracker > Mobile data & Wi-Fi
   - Enable "Background data"

4. Rebuild the app
   ```bash
   npx expo prebuild --clean
   npx expo run:android
   ```

### Notification Not Showing

**Issue:** No persistent notification appears

**Solution:**
- This indicates foreground service is not running
- Check app.json has `isAndroidForegroundServiceEnabled: true`
- Rebuild the app completely

### Locations Not Syncing

**Issue:** Locations queued but not sent to server

**Solutions:**
1. Check API endpoint in `constants/api.js`
   - Must be accessible from the device
   - Cannot be `localhost` on physical device
   - Use IP address or deployed URL

2. Verify network connectivity
   - Check device has internet access
   - Check server is running

3. Check dead queue
   - Click "Clear Dead Queue" button
   - Failed locations move here after max retries

### High Battery Usage

**Issue:** App consuming too much battery

**Solutions:**
1. Reduce tracking frequency in `app/(app)/tracking.jsx`:
   ```javascript
   timeInterval: 10000, // Change from 5000 to 10000 (10 seconds)
   distanceInterval: 20, // Change from 10 to 20 (20 meters)
   ```

2. Use `Location.Accuracy.Balanced` instead of `High`

3. Implement activity detection (future enhancement)

## API Endpoint Configuration

**Current Issue:** The API is hardcoded to `localhost:3000`

**For Physical Device Testing:**

Edit `constants/api.js`:
```javascript
// Option 1: Use your computer's local IP
export const API_BASE = 'http://192.168.1.100:3000/api';

// Option 2: Use deployed backend
export const API_BASE = 'https://tracking-api-1-hv18.onrender.com/api';
```

**To find your local IP:**
```bash
# Mac/Linux
ifconfig | grep "inet "

# Windows
ipconfig
```

## Architecture Decisions

### Why TaskManager?
- Expo's recommended approach for background tasks
- Survives app closure and device restarts
- Integrates with Android foreground services
- Handles task lifecycle automatically

### Why Foreground Service?
- Required by Android 8+ for background location
- Provides user transparency (persistent notification)
- Prevents system from killing the process
- Meets Google Play Store requirements

### Why Queue + Sync?
- Handles offline scenarios
- Prevents location data loss
- Reduces server load (batch uploads)
- Provides retry logic for failed uploads
- Better battery efficiency

## Future Enhancements

1. **Activity Detection**
   - Detect when user is stationary
   - Pause tracking to save battery
   - Resume when movement detected

2. **Geofencing**
   - Define work areas
   - Only track within specific regions
   - Alert when entering/leaving zones

3. **Better Error Handling**
   - Show user-friendly error messages
   - Automatic recovery from failures
   - Error reporting to admin

4. **Analytics Dashboard**
   - Battery usage statistics
   - Upload success rate
   - Average queue size
   - Network efficiency metrics

5. **iOS Support**
   - Currently Android-only
   - iOS has different background requirements
   - Needs separate implementation

## Important Notes

⚠️ **Google Play Store Requirements:**
- Apps using background location must declare it in store listing
- Must have clear user-facing feature requiring background location
- Must request permission at runtime (already implemented)
- Must show prominent disclosure before requesting permission

⚠️ **Battery Impact:**
- Background location tracking will increase battery usage
- Users should be informed of this
- Consider adding battery optimization tips in app

⚠️ **Privacy Considerations:**
- Location data is sensitive
- Ensure proper data handling on backend
- Implement data retention policies
- Allow users to export/delete their data

## Files Modified/Created

### Created:
- `services/backgroundLocationTask.js` - Background task definition
- `BACKGROUND_TRACKING_GUIDE.md` - This guide

### Modified:
- `app/(app)/tracking.jsx` - Added background tracking UI and logic
- `app.json` - Added permissions and plugin configuration
- `app/_layout.jsx` - Import background task for registration

## Testing Checklist

- [ ] Foreground tracking works
- [ ] Background tracking starts successfully
- [ ] Notification shows when background tracking active
- [ ] Locations tracked with app closed
- [ ] Locations tracked with screen off
- [ ] Offline queuing works
- [ ] Queue syncs when back online
- [ ] Can stop background tracking
- [ ] Notification disappears when stopped
- [ ] Battery usage is acceptable
- [ ] API endpoints accessible from device

## Support

For issues or questions:
1. Check this guide
2. Review console logs: `npx expo start`
3. Check device logs: `adb logcat | grep "BG Task"`
4. Review error queue: Click "Clear Dead Queue" to see failed uploads
