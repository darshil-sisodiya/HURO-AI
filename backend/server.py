from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
from passlib.hash import bcrypt
from bson import ObjectId
from emergentintegrations.llm.chat import LlmChat, UserMessage
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DAYS = 30

# Emergent LLM Key
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# ==================== MODELS ====================

class UserRegister(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    token: str
    username: str

class HealthProfileCreate(BaseModel):
    sleep_pattern: str  # "early_bird", "night_owl", "irregular"
    sleep_hours: int  # average hours per night
    hydration_level: str  # "poor", "moderate", "good"
    stress_level: str  # "low", "moderate", "high"
    exercise_frequency: str  # "never", "occasional", "regular", "daily"
    diet_type: str  # "balanced", "vegetarian", "vegan", "fast_food", "other"
    existing_conditions: Optional[str] = None
    lifestyle_notes: Optional[str] = None

class HealthProfileResponse(BaseModel):
    id: str
    user_id: str
    sleep_pattern: str
    sleep_hours: int
    hydration_level: str
    stress_level: str
    exercise_frequency: str
    diet_type: str
    existing_conditions: Optional[str]
    lifestyle_notes: Optional[str]
    health_persona: Optional[str]
    created_at: datetime
    updated_at: datetime

class TimelineEntryCreate(BaseModel):
    entry_type: str  # "symptom", "mood", "medicine", "sleep", "hydration", "note"
    title: str
    description: Optional[str] = None
    severity: Optional[int] = None  # 1-5 for symptoms
    tags: Optional[List[str]] = []

class TimelineEntryResponse(BaseModel):
    id: str
    user_id: str
    entry_type: str
    title: str
    description: Optional[str]
    severity: Optional[int]
    tags: List[str]
    timestamp: datetime

class ChatMessageCreate(BaseModel):
    message: str

class ChatMessageResponse(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime

class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessageResponse]

# ==================== AUTH HELPERS ====================

def create_token(username: str) -> str:
    payload = {
        'username': username,
        'exp': datetime.utcnow() + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        username = payload.get('username')
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        return username
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Hash password
    hashed_password = bcrypt.hash(user.password)
    
    # Create user
    user_doc = {
        "username": user.username,
        "email": user.email,
        "password_hash": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create token
    token = create_token(user.username)
    
    return TokenResponse(token=token, username=user.username)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user: UserLogin):
    # Find user
    user_doc = await db.users.find_one({"username": user.username})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not bcrypt.verify(user.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create token
    token = create_token(user.username)
    
    return TokenResponse(token=token, username=user.username)

# ==================== HEALTH PROFILE ENDPOINTS ====================

@api_router.post("/health/profile", response_model=HealthProfileResponse)
async def create_or_update_health_profile(
    profile: HealthProfileCreate,
    username: str = Depends(verify_token)
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    # Generate health persona using Gemini
    persona_prompt = f"""
Based on this health profile, create a fun and engaging "health persona" in 1-2 sentences:

- Sleep Pattern: {profile.sleep_pattern} ({profile.sleep_hours} hours)
- Hydration: {profile.hydration_level}
- Stress Level: {profile.stress_level}
- Exercise: {profile.exercise_frequency}
- Diet: {profile.diet_type}

Make it playful and memorable, like "You're a Night Owl Strategist" or "You're a Zen Snacker".
"""
    
    health_persona = "Health Warrior in Training"  # Default
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"persona_{user_id}",
            system_message="You are a creative health coach who creates fun, memorable health personas."
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(text=persona_prompt)
        response = await chat.send_message(user_message)
        health_persona = response.strip()
    except Exception as e:
        logging.error(f"Error generating persona: {e}")
    
    # Check if profile exists
    existing_profile = await db.health_profiles.find_one({"user_id": user_id})
    
    profile_doc = {
        "user_id": user_id,
        **profile.dict(),
        "health_persona": health_persona,
        "updated_at": datetime.utcnow()
    }
    
    if existing_profile:
        profile_doc["created_at"] = existing_profile["created_at"]
        await db.health_profiles.update_one(
            {"user_id": user_id},
            {"$set": profile_doc}
        )
        profile_id = str(existing_profile["_id"])
    else:
        profile_doc["created_at"] = datetime.utcnow()
        result = await db.health_profiles.insert_one(profile_doc)
        profile_id = str(result.inserted_id)
    
    return HealthProfileResponse(
        id=profile_id,
        **profile_doc
    )

@api_router.get("/health/profile", response_model=Optional[HealthProfileResponse])
async def get_health_profile(username: str = Depends(verify_token)):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    profile = await db.health_profiles.find_one({"user_id": user_id})
    
    if not profile:
        return None
    
    return HealthProfileResponse(
        id=str(profile["_id"]),
        **{k: v for k, v in profile.items() if k != "_id"}
    )

# ==================== TIMELINE ENDPOINTS ====================

@api_router.post("/timeline/entry", response_model=TimelineEntryResponse)
async def create_timeline_entry(
    entry: TimelineEntryCreate,
    username: str = Depends(verify_token)
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    entry_doc = {
        "user_id": user_id,
        **entry.dict(),
        "timestamp": datetime.utcnow()
    }
    
    result = await db.timeline_entries.insert_one(entry_doc)
    
    return TimelineEntryResponse(
        id=str(result.inserted_id),
        **{k: v for k, v in entry_doc.items() if k != "_id"}
    )

@api_router.get("/timeline/entries", response_model=List[TimelineEntryResponse])
async def get_timeline_entries(
    limit: int = 50,
    username: str = Depends(verify_token)
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    entries = await db.timeline_entries.find(
        {"user_id": user_id}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return [
        TimelineEntryResponse(
            id=str(entry["_id"]),
            **{k: v for k, v in entry.items() if k != "_id"}
        )
        for entry in entries
    ]

# ==================== CHAT ENDPOINTS ====================

@api_router.post("/chat/message", response_model=ChatMessageResponse)
async def send_chat_message(
    message: ChatMessageCreate,
    username: str = Depends(verify_token)
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    # Get user's health profile for context
    profile = await db.health_profiles.find_one({"user_id": user_id})
    
    # Get recent timeline entries for context
    recent_entries = await db.timeline_entries.find(
        {"user_id": user_id}
    ).sort("timestamp", -1).limit(10).to_list(10)
    
    # Build context
    context = "You are a helpful health assistant."
    if profile:
        context += f"\n\nUser's Health Profile:\n"
        context += f"- Persona: {profile.get('health_persona', 'N/A')}\n"
        context += f"- Sleep: {profile.get('sleep_pattern')} ({profile.get('sleep_hours')}h)\n"
        context += f"- Stress: {profile.get('stress_level')}\n"
        context += f"- Exercise: {profile.get('exercise_frequency')}\n"
    
    if recent_entries:
        context += "\n\nRecent Health Timeline:\n"
        for entry in recent_entries[:5]:
            context += f"- {entry.get('entry_type')}: {entry.get('title')}\n"
    
    # Save user message
    user_msg_doc = {
        "user_id": user_id,
        "role": "user",
        "content": message.message,
        "timestamp": datetime.utcnow()
    }
    await db.chat_messages.insert_one(user_msg_doc)
    
    # Get AI response
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"health_chat_{user_id}",
            system_message=context
        ).with_model("gemini", "gemini-2.0-flash")
        
        user_message = UserMessage(text=message.message)
        response = await chat.send_message(user_message)
        
        # Save assistant message
        assistant_msg_doc = {
            "user_id": user_id,
            "role": "assistant",
            "content": response,
            "timestamp": datetime.utcnow()
        }
        await db.chat_messages.insert_one(assistant_msg_doc)
        
        return ChatMessageResponse(
            role="assistant",
            content=response,
            timestamp=assistant_msg_doc["timestamp"]
        )
    except Exception as e:
        logging.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to get AI response")

@api_router.get("/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    limit: int = 50,
    username: str = Depends(verify_token)
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    messages = await db.chat_messages.find(
        {"user_id": user_id}
    ).sort("timestamp", 1).limit(limit).to_list(limit)
    
    return ChatHistoryResponse(
        messages=[
            ChatMessageResponse(
                role=msg["role"],
                content=msg["content"],
                timestamp=msg["timestamp"]
            )
            for msg in messages
        ]
    )

# ==================== CHALLENGES ENDPOINTS ====================

class ChallengeCreate(BaseModel):
    challenge_type: str  # "hydration", "no_sugar", "mindful_morning", "exercise", "sleep"
    duration_days: int
    title: str
    description: str

class ChallengeResponse(BaseModel):
    id: str
    user_id: str
    challenge_type: str
    duration_days: int
    title: str
    description: str
    start_date: datetime
    end_date: datetime
    completed_days: int
    is_active: bool
    is_completed: bool
    badges: List[str]
    created_at: datetime

class ChallengeCheckIn(BaseModel):
    challenge_id: str
    notes: Optional[str] = None

@api_router.post("/challenges/create", response_model=ChallengeResponse)
async def create_challenge(
    challenge: ChallengeCreate,
    username: str = Depends(verify_token)
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    start_date = datetime.utcnow()
    end_date = start_date + timedelta(days=challenge.duration_days)
    
    challenge_doc = {
        "user_id": user_id,
        **challenge.dict(),
        "start_date": start_date,
        "end_date": end_date,
        "completed_days": 0,
        "is_active": True,
        "is_completed": False,
        "badges": [],
        "check_ins": [],
        "created_at": start_date
    }
    
    result = await db.challenges.insert_one(challenge_doc)
    
    return ChallengeResponse(
        id=str(result.inserted_id),
        **{k: v for k, v in challenge_doc.items() if k != "_id"}
    )

@api_router.get("/challenges/active", response_model=List[ChallengeResponse])
async def get_active_challenges(username: str = Depends(verify_token)):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    challenges = await db.challenges.find({
        "user_id": user_id,
        "is_active": True
    }).to_list(100)
    
    return [
        ChallengeResponse(
            id=str(c["_id"]),
            **{k: v for k, v in c.items() if k != "_id"}
        )
        for c in challenges
    ]

@api_router.post("/challenges/checkin")
async def challenge_checkin(
    checkin: ChallengeCheckIn,
    username: str = Depends(verify_token)
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    try:
        challenge_id = ObjectId(checkin.challenge_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid challenge ID")
    
    challenge = await db.challenges.find_one({
        "_id": challenge_id,
        "user_id": user_id
    })
    
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Add check-in
    completed_days = challenge["completed_days"] + 1
    check_in_data = {
        "date": datetime.utcnow(),
        "notes": checkin.notes
    }
    
    # Award badges
    badges = challenge.get("badges", [])
    if completed_days == 3 and "3_day_streak" not in badges:
        badges.append("3_day_streak")
    if completed_days == 7 and "week_warrior" not in badges:
        badges.append("week_warrior")
    if completed_days >= challenge["duration_days"]:
        badges.append("challenge_completed")
    
    is_completed = completed_days >= challenge["duration_days"]
    
    await db.challenges.update_one(
        {"_id": challenge_id},
        {
            "$set": {
                "completed_days": completed_days,
                "is_completed": is_completed,
                "is_active": not is_completed,
                "badges": badges
            },
            "$push": {"check_ins": check_in_data}
        }
    )
    
    # Generate AI feedback
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"challenge_{user_id}",
            system_message="You are an encouraging fitness coach. Give brief, motivating feedback."
        ).with_model("gemini", "gemini-2.0-flash")
        
        prompt = f"User completed day {completed_days} of {challenge['duration_days']} in their {challenge['title']} challenge. Give them a brief motivating message (1-2 sentences)."
        user_message = UserMessage(text=prompt)
        feedback = await chat.send_message(user_message)
    except:
        feedback = "Great job! Keep up the momentum!"
    
    return {
        "success": True,
        "completed_days": completed_days,
        "badges": badges,
        "is_completed": is_completed,
        "ai_feedback": feedback
    }

# ==================== BODY MAP ENDPOINTS ====================

class BodyMapSymptom(BaseModel):
    body_part: str
    pain_level: int  # 1-5
    description: Optional[str] = None

@api_router.post("/bodymap/analyze")
async def analyze_symptom(
    symptom: BodyMapSymptom,
    username: str = Depends(verify_token)
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    # Get user's health profile for context
    profile = await db.health_profiles.find_one({"user_id": user_id})
    
    # Get recent symptoms
    recent_symptoms = await db.timeline_entries.find({
        "user_id": user_id,
        "entry_type": "symptom"
    }).sort("timestamp", -1).limit(5).to_list(5)
    
    context = f"Body part: {symptom.body_part}, Pain level: {symptom.pain_level}/5"
    if symptom.description:
        context += f", Description: {symptom.description}"
    
    if profile:
        context += f"\\n\\nUser's health background: Stress level: {profile.get('stress_level')}, Exercise: {profile.get('exercise_frequency')}, Sleep: {profile.get('sleep_hours')}h"
    
    if recent_symptoms:
        context += "\\n\\nRecent symptoms: "
        for s in recent_symptoms[:3]:
            context += f"{s.get('title')}, "
    
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"bodymap_{user_id}",
            system_message="You are a helpful health advisor. Provide general health information, not medical diagnosis."
        ).with_model("gemini", "gemini-2.0-flash")
        
        prompt = f"""Based on this information: {context}

Provide:
1. Possible causes (2-3 common reasons)
2. Safe home remedies (2-3 suggestions)
3. When to see a doctor (warning signs)

Keep it concise and easy to understand. Remember this is general information, not medical advice."""
        
        user_message = UserMessage(text=prompt)
        analysis = await chat.send_message(user_message)
        
        # Save to database
        symptom_doc = {
            "user_id": user_id,
            "body_part": symptom.body_part,
            "pain_level": symptom.pain_level,
            "description": symptom.description,
            "analysis": analysis,
            "timestamp": datetime.utcnow()
        }
        await db.body_map_entries.insert_one(symptom_doc)
        
        return {
            "body_part": symptom.body_part,
            "analysis": analysis,
            "affected_areas": [symptom.body_part],  # Could expand to related areas
            "severity": "high" if symptom.pain_level >= 4 else "moderate" if symptom.pain_level >= 2 else "low"
        }
    except Exception as e:
        logging.error(f"Error analyzing symptom: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze symptom")

# ==================== INSIGHTS ENDPOINTS ====================

@api_router.get("/insights/patterns")
async def get_health_patterns(username: str = Depends(verify_token)):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    # Get timeline entries from last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    entries = await db.timeline_entries.find({
        "user_id": user_id,
        "timestamp": {"$gte": thirty_days_ago}
    }).to_list(1000)
    
    # Analyze patterns
    symptom_count = sum(1 for e in entries if e["entry_type"] == "symptom")
    mood_entries = [e for e in entries if e["entry_type"] == "mood"]
    sleep_entries = [e for e in entries if e["entry_type"] == "sleep"]
    hydration_entries = [e for e in entries if e["entry_type"] == "hydration"]
    
    # Count streaks
    stress_free_days = 0
    for entry in mood_entries:
        if "stress" not in entry.get("title", "").lower() and "anxious" not in entry.get("title", "").lower():
            stress_free_days += 1
    
    # Generate AI insights
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"insights_{user_id}",
            system_message="You are a health data analyst. Provide brief, actionable insights."
        ).with_model("gemini", "gemini-2.0-flash")
        
        prompt = f"""Analyze this health data from the last 30 days:
- Symptoms logged: {symptom_count}
- Mood entries: {len(mood_entries)}
- Sleep tracking: {len(sleep_entries)}
- Hydration logs: {len(hydration_entries)}

Provide 2-3 brief, actionable insights or predictions. Be encouraging but realistic."""
        
        user_message = UserMessage(text=prompt)
        ai_insights = await chat.send_message(user_message)
    except:
        ai_insights = "Keep tracking your health to see patterns!"
    
    return {
        "total_entries": len(entries),
        "symptoms_this_month": symptom_count,
        "stress_free_days": stress_free_days,
        "hydration_logs": len(hydration_entries),
        "ai_insights": ai_insights,
        "trends": {
            "symptom_trend": "increasing" if symptom_count > 10 else "stable",
            "hydration_trend": "good" if len(hydration_entries) > 15 else "needs_improvement"
        }
    }

# ==================== REMINDERS ENDPOINTS ====================

class ReminderCreate(BaseModel):
    reminder_type: str  # "hydration", "movement", "sleep", "custom"
    frequency_hours: int
    message: str
    is_sarcastic: bool = False

class ReminderResponse(BaseModel):
    id: str
    user_id: str
    reminder_type: str
    frequency_hours: int
    message: str
    is_sarcastic: bool
    is_active: bool
    last_sent: Optional[datetime]
    created_at: datetime

@api_router.post("/reminders/create", response_model=ReminderResponse)
async def create_reminder(
    reminder: ReminderCreate,
    username: str = Depends(verify_token)
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    reminder_doc = {
        "user_id": user_id,
        **reminder.dict(),
        "is_active": True,
        "last_sent": None,
        "created_at": datetime.utcnow()
    }
    
    result = await db.reminders.insert_one(reminder_doc)
    
    return ReminderResponse(
        id=str(result.inserted_id),
        **{k: v for k, v in reminder_doc.items() if k != "_id"}
    )

@api_router.get("/reminders/active", response_model=List[ReminderResponse])
async def get_active_reminders(username: str = Depends(verify_token)):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    reminders = await db.reminders.find({
        "user_id": user_id,
        "is_active": True
    }).to_list(100)
    
    return [
        ReminderResponse(
            id=str(r["_id"]),
            **{k: v for k, v in r.items() if k != "_id"}
        )
        for r in reminders
    ]

@api_router.post("/reminders/{reminder_id}/toggle")
async def toggle_reminder(
    reminder_id: str,
    username: str = Depends(verify_token)
):
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_id = str(user["_id"])
    
    try:
        reminder_obj_id = ObjectId(reminder_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid reminder ID")
    
    reminder = await db.reminders.find_one({
        "_id": reminder_obj_id,
        "user_id": user_id
    })
    
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    new_status = not reminder["is_active"]
    await db.reminders.update_one(
        {"_id": reminder_obj_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"success": True, "is_active": new_status}

# ==================== HEALTH ENDPOINT ====================

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow()}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
