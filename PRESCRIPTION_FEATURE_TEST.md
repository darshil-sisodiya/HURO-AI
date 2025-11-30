# Prescription Feature Testing Guide

## What Was Fixed

### Backend Issues Fixed
1. **PDF Generator** (`backend/pdf_generator.py`)
   - ✅ Added `prescriptions` and `prescription_ai_summary` parameters to `create_health_report_pdf()`
   - ✅ Added "Prescriptions & Medication Analysis" table section
   - ✅ Added "AI Prescription Insights" section with AI-generated summary

2. **Server Endpoint** (`backend/server.py`)
   - ✅ Fixed critical bug: prescription fetching code was placed AFTER the PDF generation call
   - ✅ Moved prescription fetching BEFORE `create_health_report_pdf()` call
   - ✅ Added prescription context to chat endpoint
   - ✅ AI generates short prescription summary for the PDF report

### Frontend Issues Fixed
1. **Insights Tab** (`frontend/app/(tabs)/insights.tsx`)
   - ✅ Added TouchableOpacity import
   - ✅ Fixed "Open Health Report (PDF)" button to be clickable
   - ✅ Button opens browser with token passed as query param

2. **Chat Tab** (`frontend/app/(tabs)/chat.tsx`)
   - ✅ Fetches user's recent prescriptions on load
   - ✅ Displays prescription chips under header
   - ✅ Tapping chip inserts prescription reference into chat
   - ✅ Backend automatically includes prescriptions in context

## How to Test

### Prerequisites
1. Backend must be running:
```powershell
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

2. Ensure environment variables are set:
   - `GEMINI_API_KEY` - for AI summaries
   - `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD` - for database
   - Frontend `API_BASE_URL` should point to backend

3. Have at least ONE prescription uploaded for your user account

### Test 1: Upload a Prescription
1. Open the app
2. Go to Prescriptions tab
3. Upload a prescription image
4. Verify it shows extracted medication, dosage, and AI analysis

### Test 2: View Report with Prescriptions
1. Go to **Insights tab**
2. Scroll to top and tap **"Open Health Report (PDF)"** button
3. Browser should open and download/display PDF
4. **VERIFY the PDF contains:**
   - "Prescriptions & Medication Analysis" section (should be on page 2)
   - Table with: Medication | Dosage/Frequency | Notes
   - "AI Prescription Insights" section with AI-generated summary

### Test 3: Chat References Prescriptions (Automatic)
1. Go to **Chat tab**
2. Ask: "What should I know about my health today?"
3. **VERIFY:**
   - AI response mentions your prescriptions
   - AI may say things like "take your medication as prescribed" or reference specific meds
   - Context is automatic - AI knows about prescriptions without you mentioning them

### Test 4: Chat References Prescriptions (Manual with Chips)
1. Go to **Chat tab**
2. You should see "Your prescriptions:" bar with chips showing medication names
3. Tap a medication chip
4. Input field should populate with "Please reference my prescription: [medication name]"
5. Send the message
6. **VERIFY:** AI responds with specific advice about that medication

## Expected PDF Structure

```
Page 1:
- Title: Health Report
- Report Info (Date, Patient, Type)
- Overall Health Score
- Health Profile

Page 2:
- Prescriptions & Medication Analysis (TABLE)
  - Medication | Dosage/Frequency | Notes
  - [Your medications listed here]
- AI Prescription Insights
  - [AI-generated summary of prescriptions]

Page 3:
- Health Patterns & Insights
- AI Health Analysis
- Detailed Health Log
...
```

## Troubleshooting

### Issue: No prescriptions section in PDF
**Cause:** No prescriptions uploaded for your account
**Fix:** Upload at least one prescription first

### Issue: PDF doesn't open from app
**Causes:**
1. `API_BASE_URL` not set correctly in frontend
2. Backend not running
3. Token expired

**Fix:**
```powershell
# Check frontend/.env
cat frontend/.env
# Should contain: API_BASE_URL=http://YOUR_BACKEND_URL
```

### Issue: Chat doesn't mention prescriptions
**Causes:**
1. No prescriptions uploaded
2. Backend not fetching prescriptions (check logs)

**Fix:**
- Check backend logs for errors
- Verify prescriptions exist: `curl http://localhost:8000/api/prescriptions/history -H "Authorization: Bearer YOUR_TOKEN"`

### Issue: AI Prescription Insights says "No insights available"
**Cause:** Gemini API not configured or call failed
**Fix:**
- Set `GEMINI_API_KEY` in backend/.env
- Check backend logs for Gemini errors
- Fallback: PDF will still show prescriptions table and stored analysis

## Backend Logs to Monitor

When generating PDF, you should see:
```
INFO - Fetching prescriptions for user_id: X
INFO - Found N prescriptions
INFO - Generating prescription AI summary
INFO - Creating PDF with prescriptions
```

## API Endpoints Used

1. `GET /api/prescriptions/history?limit=5` - Chat & frontend fetch prescriptions
2. `GET /api/health/generate-report?token=XXX` - Generate PDF report
3. `POST /api/chat/message` - Chat with prescription context

## Code Verification Checklist

### Backend (server.py)
- [ ] Line ~1790: Prescription fetching happens BEFORE `create_health_report_pdf()`
- [ ] Prescriptions passed to `create_health_report_pdf()` as parameter
- [ ] `prescription_ai_summary` generated via Gemini
- [ ] Chat endpoint includes prescriptions in context (line ~686)

### Backend (pdf_generator.py)
- [ ] Line ~54: Function signature includes `prescriptions` and `prescription_ai_summary` parameters
- [ ] Line ~229-267: Prescriptions section rendered before Health Insights
- [ ] Table with 3 columns: Medication, Dosage/Frequency, Notes
- [ ] AI Prescription Insights paragraph rendered

### Frontend (insights.tsx)
- [ ] TouchableOpacity imported
- [ ] Button uses TouchableOpacity with onPress={openHealthReport}
- [ ] URL includes token as query param

### Frontend (chat.tsx)
- [ ] Fetches prescriptions on load
- [ ] Displays prescription chips
- [ ] Chips insert prescription reference text

## Success Criteria

✅ PDF contains "Prescriptions & Medication Analysis" section
✅ PDF contains "AI Prescription Insights" section
✅ PDF shows actual medication names, dosages, and AI analysis
✅ Chat automatically mentions prescriptions when relevant
✅ Prescription chips appear in chat and work when tapped
✅ Report button in Insights tab opens PDF in browser

## Need Help?

If after testing the prescription section STILL doesn't appear in PDF:
1. Check backend terminal for errors when generating report
2. Verify database has prescriptions: `SELECT * FROM prescriptions WHERE user_id=X;`
3. Add debug logging before `create_health_report_pdf()` call:
   ```python
   logging.info(f"Prescriptions being passed to PDF: {len(prescriptions)} items")
   logging.info(f"Prescription AI summary: {prescription_ai_summary[:100] if prescription_ai_summary else 'None'}")
   ```
