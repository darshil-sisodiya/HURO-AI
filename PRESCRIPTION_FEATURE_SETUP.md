# Prescription Analysis Feature Setup

## Overview
A complete prescription analysis feature that allows users to:
- Upload photos of prescriptions
- Extract text using OCR (Optical Character Recognition)
- Get AI-powered analysis with personalized advice
- Track medication history

## Backend Setup

### 1. Install Python Dependencies

First, install Tesseract OCR on your system:

**Windows:**
```powershell
# Download and install Tesseract from:
# https://github.com/UB-Mannheim/tesseract/wiki
# Make sure to add Tesseract to your PATH
```

**macOS:**
```bash
brew install tesseract
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr
```

Then install Python packages:
```powershell
cd backend
pip install -r requirements.txt
```

### 2. Database Migration

The `prescriptions` table will be created automatically when the backend starts. It includes:
- Extracted text from prescription image
- Medication details (name, dosage, frequency, timing)
- AI analysis and personalized advice
- Side effects and interaction warnings

### 3. Backend Endpoints

The following endpoints have been added:

- `POST /api/prescriptions/upload` - Upload prescription image and get analysis
- `GET /api/prescriptions/history?limit=20` - Get prescription history
- `GET /api/prescriptions/{prescription_id}` - Get specific prescription details

## Frontend Setup

### 1. Install Required Packages

```powershell
cd frontend
npx expo install expo-image-picker
```

### 2. Configure Permissions

Add to `app.json` if not already present:
```json
{
  "expo": {
    "plugins": [
      [
        "expo-image-picker",
        {
          "photosPermission": "The app accesses your photos to let you upload prescription images.",
          "cameraPermission": "The app accesses your camera to let you take prescription photos."
        }
      ]
    ]
  }
}
```

## Features

### 1. Image Upload
- Take photo with camera
- Choose from photo library
- Automatic image quality optimization

### 2. OCR Text Extraction
- Uses Tesseract OCR engine
- Extracts text from prescription images
- Handles various image formats and qualities

### 3. AI Analysis
The AI analyzes the prescription and provides:
- **Medication Name**: Identifies the prescribed medication
- **Dosage**: Exact dosage information
- **Frequency**: How often to take it (e.g., "twice daily")
- **Timing**: Best time to take (e.g., "with meals", "before bedtime")
- **Purpose**: What the medication treats
- **Side Effects**: Common side effects to watch for
- **Interactions**: Warnings about food, lifestyle, or health condition interactions
- **Personalized Advice**: Customized guidance based on:
  - User's health profile (sleep, stress, exercise, diet)
  - Recent health logs and symptoms
  - Existing medical conditions

### 4. Prescription History
- View all uploaded prescriptions
- Quick access to medication details
- Search and filter capabilities

## Usage

### For Users

1. **Upload a Prescription:**
   - Navigate to the "Rx" tab in the app
   - Tap the "+" button
   - Choose "Take Photo" or "Choose from Library"
   - Wait for AI analysis (typically 5-10 seconds)

2. **View Analysis:**
   - See extracted medication details
   - Read personalized advice based on your health profile
   - Check side effects and warnings
   - Get timing recommendations

3. **Access History:**
   - View all past prescriptions
   - Tap any prescription for full details
   - Pull to refresh the list

### Important Notes

⚠️ **Disclaimer**: This feature provides general health information and is not a substitute for professional medical advice. Always consult with your healthcare provider for medical decisions.

## Testing

### Backend Testing

Test prescription upload via curl:
```powershell
# Replace TOKEN and IMAGE_PATH with actual values
$TOKEN = "your_jwt_token"
$IMAGE = "C:\path\to\prescription.jpg"

curl -X POST "http://localhost:8000/api/prescriptions/upload" `
  -H "Authorization: Bearer $TOKEN" `
  -F "file=@$IMAGE"
```

### Frontend Testing

1. Ensure backend is running (`python backend/server.py`)
2. Start frontend (`npx expo start`)
3. Test on device or emulator
4. Upload a clear photo of a prescription
5. Verify all analysis sections appear

## Troubleshooting

### OCR Issues

**Problem**: "Could not extract text from image"
- Ensure Tesseract is installed and in PATH
- Check image quality - it should be clear and well-lit
- Try a different image format

**Solution**:
```powershell
# Verify Tesseract installation
tesseract --version

# On Windows, if not found, add to PATH or configure in code:
# In server.py, add: pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

### Upload Errors

**Problem**: Image upload fails
- Check file size (should be < 10MB)
- Verify network connectivity
- Ensure proper authentication token

### AI Analysis Issues

**Problem**: Analysis returns generic response
- Check Gemini API key is configured in backend `.env`
- Verify user has completed health profile
- Check backend logs for API errors

## Security Considerations

1. **Image Storage**: Currently images are not stored permanently. Consider adding secure storage if needed.
2. **Data Privacy**: Prescription data contains sensitive health information - ensure HTTPS in production
3. **Authentication**: All endpoints require JWT authentication
4. **Input Validation**: File type and size validation on upload

## Future Enhancements

- [ ] Medication reminders based on prescription frequency
- [ ] Drug interaction checking across multiple prescriptions
- [ ] Export prescription list to PDF
- [ ] Integration with pharmacy APIs
- [ ] Barcode/QR code scanning for medications
- [ ] Dosage tracking and medication adherence monitoring
