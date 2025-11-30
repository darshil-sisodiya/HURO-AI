# Deployment Guide for HealthAssistant

This guide covers how to deploy the HealthAssistant project. The project consists of a Python FastAPI backend (with MySQL) and a React Native Expo frontend.

## 1. Backend Deployment (Recommended: Render)

Render is a great choice because it supports Python apps and managed MySQL databases easily.

### Prerequisites
- A GitHub account.
- A [Render](https://render.com/) account.

### Steps

1.  **Push Code to GitHub**: Ensure your project is pushed to a GitHub repository.
2.  **Create a Database**:
    -   Go to the Render Dashboard.
    -   Click **New +** -> **PostgreSQL** (Wait, we use MySQL).
    -   *Note*: Render offers PostgreSQL natively. For MySQL, you can use a managed MySQL provider like **Aiven** (free tier available) or **PlanetScale** (if compatible), or deploy a MySQL Docker container on Render (more complex).
    -   **Alternative**: Use **Railway** (see below) which supports MySQL natively.

### **Option A: Deploying on Railway (Easiest for MySQL)**

Railway is excellent for this stack as it provides MySQL out of the box.

1.  **Sign up** at [Railway.app](https://railway.app/).
2.  **New Project** -> **Deploy from GitHub repo**.
3.  Select your repository.
4.  **Add a Database**:
    -   Right-click on the canvas or click "New" -> **Database** -> **MySQL**.
    -   This will create a MySQL service.
5.  **Configure Backend Service**:
    -   Click on your backend service (the repo you deployed).
    -   Go to **Variables**.
    -   Add the following environment variables (you can get DB values from the MySQL service "Connect" tab):
        -   `MYSQL_HOST`: (e.g., `mysql.railway.internal`)
        -   `MYSQL_PORT`: (e.g., `3306`)
        -   `MYSQL_USER`: (e.g., `root`)
        -   `MYSQL_PASSWORD`: (from Railway MySQL variables)
        -   `MYSQL_DB`: (e.g., `railway`)
        -   `GEMINI_API_KEY`: Your Google Gemini API Key.
        -   `JWT_SECRET`: A secure random string.
6.  **Build Settings**:
    -   Railway should automatically detect the `Dockerfile` in `backend/` or the `requirements.txt`.
    -   If using `Dockerfile`, ensure the Root Directory in Railway settings is set to `backend`.
7.  **Public Domain**:
    -   Go to **Settings** -> **Networking** -> **Generate Domain**.
    -   Copy this URL (e.g., `https://health-assistant-production.up.railway.app`). You will need it for the frontend.

---

## 2. Frontend Deployment

### **Option A: Web Deployment (Vercel)**

1.  **Update API URL**:
    -   In your frontend code, you likely have a base URL for the API.
    -   Ensure your `frontend/.env` or configuration file points to the **production backend URL** you just generated (e.g., `https://health-assistant-production.up.railway.app`).
    -   *Note*: In Expo, use `EXPO_PUBLIC_API_URL` in `.env` and access it via `process.env.EXPO_PUBLIC_API_URL`.

2.  **Deploy to Vercel**:
    -   Go to [Vercel](https://vercel.com/) and "Add New Project".
    -   Import your GitHub repository.
    -   **Framework Preset**: Select **Other** or let it auto-detect (Expo usually works well).
    -   **Root Directory**: Edit this to `frontend`.
    -   **Build Command**: `npx expo export -p web`
    -   **Output Directory**: `dist`
    -   **Environment Variables**: Add any needed vars (like `EXPO_PUBLIC_API_URL`).
    -   Click **Deploy**.

### **Option B: Mobile Deployment (Expo EAS)**

To build for Android/iOS:

1.  **Install EAS CLI**:
    ```bash
    npm install -g eas-cli
    ```
2.  **Login**:
    ```bash
    eas login
    ```
3.  **Configure Project**:
    ```bash
    cd frontend
    eas build:configure
    ```
4.  **Build**:
    -   **Android**: `eas build --platform android`
    -   **iOS**: `eas build --platform ios` (Requires Apple Developer Account)
5.  **Submit**:
    -   You can use `eas submit` to send to the App Store / Play Store.

---

## Summary of Environment Variables

**Backend**:
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DB`
- `GEMINI_API_KEY`
- `JWT_SECRET`

**Frontend**:
- `EXPO_PUBLIC_API_URL`: The URL of your deployed backend.
