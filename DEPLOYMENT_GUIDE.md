# 🚀 HealthAssistant Deployment Guide

## 📋 Prerequisites

- Railway account (https://railway.app)
- MySQL database (Railway provides this)
- Gemini API key (https://ai.google.dev)
- EAS CLI installed (`npm install -g eas-cli`)

---

## 🗄️ Database Setup (Railway MySQL)

### 1. Create MySQL Service on Railway

1. Go to Railway dashboard
2. Click "New Project" → "Provision MySQL"
3. Railway will create a MySQL database
4. Copy the connection details:
   - `MYSQL_HOST`
   - `MYSQL_PORT` (usually 3306)
   - `MYSQL_USER` (usually root)
   - `MYSQL_PASSWORD`
   - `MYSQL_DATABASE`

### 2. Initialize Database Schema

Connect to your Railway MySQL and run:

```sql
CREATE DATABASE IF NOT EXISTS health_assistant;
USE health_assistant;

-- Users table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Health profiles table
CREATE TABLE health_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    age INT,
    gender VARCHAR(20),
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    blood_group VARCHAR(10),
    allergies TEXT,
    chronic_conditions TEXT,
    medications TEXT,
    emergency_contact VARCHAR(255),
    health_persona TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Timeline entries table
CREATE TABLE timeline_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    entry_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity INT,
    tags JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Body symptoms table
CREATE TABLE body_symptoms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    body_part VARCHAR(100) NOT NULL,
    symptom TEXT NOT NULL,
    severity INT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Challenges table
CREATE TABLE challenges (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    goal_type VARCHAR(50),
    target_value INT,
    current_value INT DEFAULT 0,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Prescriptions table
CREATE TABLE prescriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    image_path VARCHAR(500),
    analysis_result TEXT,
    extracted_text TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## 🔧 Backend Deployment (Railway)

### 1. Push Code to GitHub

```powershell
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Deploy to Railway

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Choose `backend` as the root directory

### 3. Configure Environment Variables

In Railway dashboard, add these variables:

```env
# Database (from Railway MySQL service)
MYSQL_HOST=containers-us-west-xxx.railway.app
MYSQL_PORT=3306
MYSQL_DB=railway
MYSQL_USER=root
MYSQL_PASSWORD=your-railway-mysql-password

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.0-flash

# JWT Security (generate a random string)
JWT_SECRET_KEY=your-super-secret-jwt-key-min-32-characters

# Optional: Google Cloud Vision (if using)
GOOGLE_APPLICATION_CREDENTIALS=/app/service-account-key.json
```

### 4. Link MySQL Database

1. In Railway, go to your backend service
2. Click "Variables" tab
3. Click "Reference" → Select your MySQL service
4. Railway will auto-populate connection variables

### 5. Deploy

Railway will automatically deploy. Your backend URL will be:
```
https://your-app-name.railway.app
```

### 6. Test Backend

```powershell
curl https://your-app-name.railway.app/health
```

Should return: `{"status": "healthy"}`

---

## 📱 Frontend Deployment (EAS Build)

### 1. Update Environment Variables

Edit `frontend/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=https://your-app-name.railway.app
```

### 2. Install EAS CLI

```powershell
npm install -g eas-cli
```

### 3. Login to EAS

```powershell
cd frontend
eas login
```

### 4. Configure Project

```powershell
eas build:configure
```

This will update your `app.json` with EAS project info.

### 5. Build Android APK

```powershell
eas build --platform android --profile preview
```

This will:
- Upload your code to EAS servers
- Build an APK file
- Provide a download link

**Build time: 15-30 minutes**

### 6. Download and Install

1. EAS will give you a URL like: `https://expo.dev/accounts/yourname/projects/HealthAssistant/builds/abc123`
2. Click the download link
3. Transfer APK to Android device
4. Install the APK

### 7. Build for iOS (Optional - Requires Apple Developer Account)

```powershell
eas build --platform ios --profile production
```

**Note:** iOS requires:
- Apple Developer account ($99/year)
- Mac computer for final testing
- App Store submission

---

## 🧪 Alternative: Expo Go (Free Testing)

For quick testing without building APK:

### 1. Publish to Expo

```powershell
cd frontend
npx expo publish
```

### 2. Share with Users

Users need to:
1. Install "Expo Go" app from Play Store/App Store
2. Scan your QR code or enter your Expo project URL

**Limitations:**
- Users must have Expo Go installed
- Can't use custom native modules
- Not a standalone app

---

## 🔐 Security Checklist

Before deploying:

- [ ] Change `JWT_SECRET_KEY` to a strong random string
- [ ] Never commit `.env` files or API keys to Git
- [ ] Update `frontend/.env` with production backend URL
- [ ] Enable CORS only for your frontend domain
- [ ] Set up SSL/HTTPS (Railway provides this automatically)
- [ ] Review database permissions
- [ ] Set up backups for MySQL database

---

## 📊 Monitoring & Logs

### Railway Logs

```
Dashboard → Your Service → Deployments → View Logs
```

### Check Backend Health

```powershell
curl https://your-app-name.railway.app/health
curl https://your-app-name.railway.app/api/test
```

---

## 💰 Cost Breakdown

| Service | Cost |
|---------|------|
| Railway Backend | $5/month (Hobby plan) |
| Railway MySQL | Included in Hobby plan |
| EAS Builds | Free (100 builds/month) |
| Expo Go Testing | FREE |
| Google Play Store | $25 one-time |
| Apple App Store | $99/year |

**Minimum to start: $5/month (Railway only)**

---

## 🐛 Troubleshooting

### Backend Won't Start

```powershell
# Check Railway logs
railway logs

# Verify environment variables are set
railway variables
```

### Database Connection Failed

- Verify MySQL service is running
- Check connection variables match
- Ensure database is created

### Frontend Can't Connect

- Check `EXPO_PUBLIC_BACKEND_URL` in `.env`
- Test backend URL in browser
- Verify CORS settings in `server.py`

### Build Failed on EAS

```powershell
# Check build logs
eas build:list

# View specific build
eas build:view <build-id>
```

---

## 🚀 Quick Deploy Commands

```powershell
# Backend (via Railway dashboard)
# Just push to GitHub and Railway auto-deploys

# Frontend - Build Android APK
cd frontend
eas login
eas build --platform android --profile preview

# Frontend - Publish to Expo Go
npx expo publish
```

---

## 📱 Distributing Your App

### Option 1: Direct APK Installation
1. Download APK from EAS
2. Share via Google Drive, Dropbox, etc.
3. Users install directly (may need to enable "Install from Unknown Sources")

### Option 2: Google Play Store (Internal Testing)
```powershell
eas submit --platform android --track internal
```

### Option 3: Expo Go
- Users install Expo Go app
- Scan QR code or enter project URL

---

## 🔄 Updating Your App

### Update Backend
```powershell
git add .
git commit -m "Update backend"
git push origin main
```
Railway auto-deploys.

### Update Frontend
```powershell
# For APK users - rebuild
eas build --platform android --profile preview

# For Expo Go users - instant update
npx expo publish
```

---

## 📞 Support

- Railway Docs: https://docs.railway.app
- EAS Docs: https://docs.expo.dev/eas
- Expo Forums: https://forums.expo.dev

---

**Ready to deploy? Start with Railway backend, then build your APK with EAS!**
