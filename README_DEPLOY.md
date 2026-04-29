# 🚀 Node.js Deployment Guide (Shared Hosting)

This application is built with **React 19** and **Node.js (Express)**. It uses **SQLite** for high-performance data storage.

## ✅ Prerequisites
*   **Node.js Support**: Your hosting (cPanel, Plesk, etc.) must support Node.js.
*   **Node.js Version**: 18.x or 20.x (Recommended).

## 📦 How to Deploy

### Step 1: Prepare the Files
1.  **Build the project**: Run `npm run build` on your local machine.
2.  This will create:
    *   **`dist/`** folder (Frontend assets)
    *   **`server.cjs`** (Bundled backend server)

### Step 2: Upload to Hosting
Upload the following files/folders to your hosting's root or `public_html` (as per your Node.js setup):
*   `dist/`
*   `server.cjs`
*   `package.json`
*   `database.sqlite` (if you want to keep existing data)

### Step 3: Server Configuration
1.  **Install Dependencies**: In your hosting panel (cPanel Node.js Selector), click **"Run NPM Install"**.
    *   *Note: This is required because SQLite needs native drivers for your server's OS.*
2.  **Startup File**: Set your application startup file to **`server.cjs`**.
3.  **Environment Variables**:
    *   `NODE_ENV`: `production`
    *   `PORT`: `3000` (or as provided by hosting)

### Step 4: Start the App
Click **"Restart"** or **"Start App"** in your hosting panel.

---

## 🔐 Default Login
*   **Username**: `admin`
*   **Password**: `admin123`

## 🛠 Troubleshooting
*   **SQLite Error**: If you see "Module not found: better-sqlite3", ensure you have run `npm install` in your hosting panel.
*   **Port Issues**: The app defaults to port 3000. If your hosting uses a different port, it will automatically detect it from the `PORT` environment variable.
