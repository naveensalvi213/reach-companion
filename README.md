# Reach Companion (Unified Workspace)

This repository contains the complete set of applications for **Reach Companion**, a 24/7 automated outreach engine for X (Twitter) and Reddit.

## Workspace Structure

*   `/backend` - Node.js Express server running the scraping and automation logic.
*   `/frontend` - React.js Web UI interface.
*   `/reach_mobile` - Flutter-based mobile companion app.
*   `/cloud-backend` - Configuration files and scripts for 24/7 cloud deployments (e.g. on Render/VPS).

---

## 1. Local Desktop Companion App (Windows)

To start the desktop companion application (launches both the Node backend and Electron wrapper):

1.  Make sure you have Node.js installed.
2.  Double-click the [`Start Reach App.bat`](file:///c:/Users/navee/Downloads/x-reddit/Start%20Reach%20App.bat) file in the root folder, or run:
    ```cmd
    node run-desktop.js
    ```

---

## 2. Mobile App Deployment (Flutter)

The mobile companion application is built using Flutter.

### Run on Windows (Directly on PC for Debugging)
To build and launch the Flutter app as a native Windows desktop app:
```bash
cd reach_mobile
flutter run -d windows
```

### Run on Android Emulator
1. Start your Android Emulator (e.g., Pixel 7).
2. Run:
   ```bash
   cd reach_mobile
   flutter run -d emulator-5554
   ```

### Deploy to your Physical Android Phone
1. Connect your phone via USB and enable **USB Debugging** in Developer Options.
2. Run:
   ```bash
   cd reach_mobile
   flutter run
   ```

---

## 3. Run Locally on Mobile (Termux Android)

To run the Node backend directly inside your phone using Termux:

1. Download **Termux** from [F-Droid](https://f-droid.org/en/packages/com.termux/).
2. Open Termux and run:
   ```bash
   termux-setup-storage
   ```
3. Copy this project folder onto your phone, go inside the project directory, and run the automated installer:
   ```bash
   bash install-android.sh
   ```
4. Once completed, start the server:
   ```bash
   termux-wake-lock
   cd backend
   node index.js
   ```

---

## 4. Cloud Deployment (VPS / Render)
To deploy the scraper and engine to run 24/7:
* Recommended: Host it on a basic VPS (like DigitalOcean, Hetzner, or Linode) by running `install-android.sh` (or using a Linux configuration equivalent).
* Alternatively, deploy the `/cloud-backend` directory to a cloud provider using the build steps inside `cloud-backend/render-build.sh`.
