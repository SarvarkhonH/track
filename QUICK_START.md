# Quick Start Guide

## Running the Geo Tracker App

### Option 1: Run on Android Emulator/Device

1. **Start the Expo development server:**
   ```bash
   npx expo start
   ```

2. **Choose your option:**
   - Press `a` to open on Android emulator
   - Scan the QR code with Expo Go app on your Android device
   - Or run: `npx expo start --android`

### Option 2: Run in Browser (Web Preview)

1. **Start Expo with web support:**
   ```bash
   npx expo start --web
   ```

2. The app will automatically open in your default browser at `http://localhost:8081`

### Option 3: Build and Run Native Android

1. **Start the native build:**
   ```bash
   npm run android
   ```
   or
   ```bash
   npx expo run:android
   ```

## Important Notes

### Before Running the App:

1. **Make sure your backend server is running** on `http://localhost:4000` (or your configured local IP).

2. **Configure API Mode** in `constants/api.js` (located at `constants/api.js`):
   - Set `API_MODE` to `"local"` for local development
   - Set `API_MODE` to `"global"` for production API

3. To test the API endpoints, use your own testing tools (Postman/cURL) or start the backend and run the app — automated test script has been removed from the repo.

### Login Credentials

You'll need valid credentials in your backend database to login. Make sure you have:
- Phone number (format: +998xxxxxxxxx)
- Password

## Troubleshooting

### Port Already in Use

If port 8081 is already in use:
```bash
npx expo start --port 8082
```

### Clear Cache

If you encounter issues:
```bash
npx expo start --clear
```

### Android Emulator Not Starting

Make sure:
1. Android Studio is installed
2. An Android emulator is set up
3. Emulator is running before starting Expo

Or use:
```bash
npx expo start --android
```

### Web Preview Issues

Make sure your dependencies include web support:
```bash
npx expo install @expo/webpack-config
```

## Project Structure

```
app/
├── (auth)/              # Authentication screens
│   └── LoginScreen.jsx   # Login interface
└── (app)/               # Main app screens
   ├── index.jsx        # Home/Shtab selection
   ├── tracking.jsx     # Location tracking
   └── employees/       # Employee management
```

## API Endpoints

The app uses these endpoints:
- `POST /api/auth/login` - User login
- `GET /api/v1/shtabs` - Fetch shtabs
- `GET /api/v1/users` - Fetch users  
- `POST /api/v1/users` - Create user
- `POST /api/v1/locations` - Create location
- `POST /api/v1/batch` - Batch locations

## Next Steps

1. Start the backend server (see `server/README.md`) and confirm it listens on `http://localhost:4000`.
2. Start the app: `npx expo start`
3. Open on device/emulator
4. Login with your credentials
5. Select a shtab and user to start tracking!

