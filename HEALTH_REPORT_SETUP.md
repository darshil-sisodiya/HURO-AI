# Health Report PDF Generation Setup

## Backend Installation

1. **Install the new dependency (reportlab):**

```powershell
cd backend
pip install -r requirements.txt
```

Or install reportlab directly:

```powershell
pip install reportlab==4.0.7
```

2. **Restart your backend server:**

```powershell
# If running with uvicorn
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Or however you normally start it
python -m uvicorn server:app --reload
```

## Frontend Setup

The frontend changes are already in place. No additional packages needed.

## How It Works

1. **User clicks "Generate Health Report"** in the Profile tab
2. **Backend gathers all data:**
   - User's health profile
   - All timeline entries (symptoms, moods, medications, sleep, hydration, notes)
   - Health insights and patterns
   - Current health score
3. **Gemini AI generates** a professional medical summary
4. **PDF is created** with:
   - Cover page with patient info
   - Overall health score with visualization
   - Health profile details
   - 30-day insights and patterns
   - AI-generated health analysis
   - Detailed health log grouped by type
   - Professional medical disclaimer
5. **PDF is downloaded** and can be opened/shared with doctors

## PDF Report Structure

- **Title Page:** Patient name, report date, report info
- **Health Score:** Visual score (0-100) with status and reasoning
- **Health Profile:** Sleep, hydration, stress, exercise, diet
- **Health Insights:** 30-day statistics and trends
- **AI Analysis:** Gemini-generated professional summary
- **Detailed Logs:** All entries organized by type (symptoms, moods, etc.)
- **Disclaimer:** Medical disclaimer for professional review

## Features

✅ Professional medical-grade PDF formatting
✅ AI-powered health summary via Gemini
✅ Comprehensive data including all logs
✅ Organized by entry type (symptoms, moods, meds, etc.)
✅ Date-stamped and paginated
✅ Ready to share with healthcare providers
✅ Automatic download on mobile/web

## Testing

1. Make sure you have some health data logged
2. Go to Profile tab
3. Click "Generate Health Report" button
4. Wait for generation (shows "Generating Report...")
5. PDF will download automatically

The PDF filename will be: `health_report_[username]_[date].pdf`
