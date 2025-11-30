# 🎨 Modern UI Quick Start

## ✅ What Was Done

### Installed Packages
```bash
npm install react-native-markdown-display expo-linear-gradient
```

### Created Components
1. **GlassCard** - Glassmorphic container with optional gradient
2. **StatCard** - Metric display with icon, value, trend
3. **QuickActionCard** - Gradient action buttons

### Enhanced Screens
- **Home**: Rich dashboard with 6+ sections
- **Chat**: Markdown rendering for AI (bold/italic work!)
- **Bodymap**: Markdown analysis + gradient buttons

## 🚀 To See Changes

1. Make sure backend is running:
```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

2. Start the Expo dev server:
```powershell
cd frontend
npm start
```

3. Press `w` for web, `a` for Android, or scan QR for device

## 📱 Key Features to Test

### Home Dashboard
- See your health score (calculated from activity)
- Quick stats with trend indicators
- AI insights banner (requires backend AI)
- Active challenges with progress bars
- Quick action cards (tap to navigate)
- Recent activity feed

### Chat
- Send a message with AI enabled
- Notice **bold words** and *italic text* render properly
- Lists and headings are formatted
- Code blocks have syntax highlighting

### Bodymap
- Tap a body part
- Add symptom description
- Get AI Analysis (requires GEMINI_API_KEY)
- See formatted analysis with sections

## 🎯 Design Highlights

### Glassmorphism
Cards have semi-transparent backgrounds with blur effects for depth

### Gradients
Primary actions use purple-to-indigo gradients (`#6366F1` → `#8B5CF6`)

### Typography
- Headers: Bold, large, high contrast
- Body: Comfortable 15-16px with 1.5 line-height
- Colors optimized for dark backgrounds

### Shadows
Multi-layer shadows create realistic depth:
- Cards: subtle elevation
- Buttons: prominent glow
- FAB: strong shadow for floating effect

## 🐛 Troubleshooting

### "Cannot find module" errors
- Run `npm install` in frontend directory
- Check that `expo-linear-gradient` and `react-native-markdown-display` are in package.json

### Components not showing
- Make sure backend is running on port 8000
- Check `.env` file exists with `EXPO_PUBLIC_BACKEND_URL`
- Verify `GEMINI_API_KEY` in backend `.env` for AI features

### Markdown not rendering
- Check that AI responses include markdown (**, *, #, etc.)
- Backend must return formatted text for it to display properly

### Styles look broken
- Clear Metro bundler cache: `npm start -- --reset-cache`
- Restart Expo dev server
- Check that all component files compiled without errors

## 📊 Health Score Calculation

```
Base Score: 100
- Symptoms: -2 per symptom (max -20)
+ Stress-free days: +1 per day
+ Hydration: +10 if 20+ logs
= Final Score (50-100)
```

Colors:
- 85-100: Green (Excellent)
- 70-84: Amber (Good)
- 50-69: Red (Needs Attention)

## 🎨 Color Reference

```typescript
Primary:    #6366F1  // Indigo
Secondary:  #8B5CF6  // Purple
Success:    #10B981  // Green
Warning:    #F59E0B  // Amber
Error:      #EF4444  // Red
Info:       #06B6D4  // Cyan
Pink:       #EC4899  // Pink

Background: #0F172A  // Dark Slate
Card:       #1E293B  // Slate
Border:     #334155  // Slate 700

Text Light: #F1F5F9  // Slate 100
Text Gray:  #94A3B8  // Slate 400
Text Muted: #64748B  // Slate 500
```

## 💡 Tips

- **Pull to refresh** on home screen reloads all data
- **Tap profile icon** (top right) to edit health profile
- **FAB button** (bottom right) adds timeline entries quickly
- **Quick action cards** navigate to respective tabs
- **Challenge progress** shows percentage completion
