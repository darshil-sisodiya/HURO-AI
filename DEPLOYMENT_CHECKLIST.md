# ✅ Deployment Checklist

Use this checklist to ensure everything is ready for deployment.

## 🔧 Pre-Deployment

- [ ] GitHub repository created and code pushed
- [ ] Railway account created (https://railway.app)
- [ ] Gemini API key obtained (https://ai.google.dev)
- [ ] MySQL database schema prepared

## 🗄️ Database Setup

- [ ] Railway MySQL service provisioned
- [ ] Database credentials saved
- [ ] Database schema executed (see DEPLOYMENT_GUIDE.md)
- [ ] Test connection successful

## 🔐 Security

- [ ] Generate strong JWT_SECRET_KEY (min 32 characters)
- [ ] `.env` files NOT committed to git
- [ ] API keys secured in Railway environment variables
- [ ] CORS configured for production domain

## 🖥️ Backend Deployment (Railway)

- [ ] Backend code pushed to GitHub
- [ ] Railway project created
- [ ] Backend folder selected as root directory
- [ ] All environment variables configured:
  - [ ] MYSQL_HOST
  - [ ] MYSQL_PORT
  - [ ] MYSQL_DB
  - [ ] MYSQL_USER
  - [ ] MYSQL_PASSWORD
  - [ ] GEMINI_API_KEY
  - [ ] JWT_SECRET_KEY
- [ ] Railway deployment successful
- [ ] Backend URL obtained (e.g., https://your-app.railway.app)
- [ ] Health endpoint working: `/health`
- [ ] API endpoints responding: `/api/test`

## 📱 Frontend Configuration

- [ ] `frontend/.env` updated with production backend URL
- [ ] `frontend/app.json` updated with correct app name
- [ ] `frontend/eas.json` created and configured
- [ ] Package name set (e.g., com.yourcompany.healthassistant)

## 🏗️ Mobile App Build

- [ ] EAS CLI installed: `npm install -g eas-cli`
- [ ] Logged into EAS account: `eas login`
- [ ] Build initiated: `eas build --platform android --profile preview`
- [ ] Build completed successfully
- [ ] APK downloaded from EAS dashboard

## 🧪 Testing

- [ ] Backend health check passes
- [ ] Frontend connects to backend
- [ ] User registration works
- [ ] User login works
- [ ] Timeline entries can be created
- [ ] AI chat responds correctly
- [ ] Prescription upload works
- [ ] Body map functions properly
- [ ] Challenges can be created

## 📦 Distribution

Choose one:

### Option A: Direct APK Distribution
- [ ] APK downloaded from EAS
- [ ] APK tested on physical device
- [ ] APK shared with users (Google Drive, etc.)

### Option B: Google Play Store
- [ ] Google Play Developer account ($25)
- [ ] App listing created
- [ ] Screenshots prepared
- [ ] Privacy policy created
- [ ] App submitted for review

### Option C: Expo Go
- [ ] Published to Expo: `npx expo publish`
- [ ] QR code shared with users
- [ ] Users have Expo Go installed

## 📊 Monitoring

- [ ] Railway logs monitored for errors
- [ ] Database backups configured
- [ ] Error tracking set up (optional)
- [ ] Usage analytics considered (optional)

## 📝 Documentation

- [ ] DEPLOYMENT_GUIDE.md reviewed
- [ ] API documentation updated
- [ ] User guide created (optional)
- [ ] Support email/contact set up

## 🚀 Post-Deployment

- [ ] App tested by beta users
- [ ] Feedback collected
- [ ] Bugs fixed
- [ ] Performance optimized
- [ ] Marketing materials prepared (optional)

---

## 🎉 Launch Day!

- [ ] Final tests completed
- [ ] Announcement prepared
- [ ] Support system ready
- [ ] Monitoring active

---

## 📞 Support Resources

- **Railway**: https://docs.railway.app
- **EAS**: https://docs.expo.dev/eas
- **Expo**: https://docs.expo.dev
- **Deployment Guide**: See DEPLOYMENT_GUIDE.md

---

**Your Deployment Progress: ___ / ___ items completed**
