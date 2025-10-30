from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
from passlib.hash import bcrypt
import asyncio
import json

# Database (MySQL, async)
import aiomysql

# Google Gemini
import google.generativeai as genai

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Gemini configuration
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-1.5-flash')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# MySQL connection (async pool)
MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
MYSQL_PORT = int(os.environ.get('MYSQL_PORT', '3306'))
MYSQL_DB = os.environ.get('MYSQL_DB', 'health_assistant')
MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '')

db_pool: Optional[aiomysql.Pool] = None

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DAYS = 30


async def ensure_database_pool() -> aiomysql.Pool:
    """Create an aiomysql pool, creating the target database if it doesn't exist.

    This handles the common dev case where the DB hasn't been created yet and avoids
    startup failure with "Unknown database" errors.
    """
    try:
        # First try with the configured DB
        return await aiomysql.create_pool(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            db=MYSQL_DB,
            autocommit=True,
            minsize=1,
            maxsize=10,
            charset="utf8mb4",
        )
    except Exception as e:
        msg = str(e)
        # If database missing, create it, then try again
        if "Unknown database" in msg or "1049" in msg:
            temp_pool = await aiomysql.create_pool(
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                autocommit=True,
                minsize=1,
                maxsize=2,
                charset="utf8mb4",
            )
            try:
                async with temp_pool.acquire() as conn:
                    async with conn.cursor() as cur:
                        await cur.execute(
                            f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DB}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                        )
                        await conn.commit()
            finally:
                temp_pool.close()
                await temp_pool.wait_closed()

            # Now create the real pool pointing at the DB
            return await aiomysql.create_pool(
                host=MYSQL_HOST,
                port=MYSQL_PORT,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                db=MYSQL_DB,
                autocommit=True,
                minsize=1,
                maxsize=10,
                charset="utf8mb4",
            )
        # Re-raise other issues (e.g., auth failure, server down)
        raise

async def fetch_one(query: str, params: tuple = ()) -> Optional[Dict[str, Any]]:
    if db_pool is None:
        raise RuntimeError('Database pool is not initialized')
    async with db_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(query, params)
            return await cur.fetchone()

async def fetch_all(query: str, params: tuple = ()) -> List[Dict[str, Any]]:
    if db_pool is None:
        raise RuntimeError('Database pool is not initialized')
    async with db_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(query, params)
            return await cur.fetchall()

async def execute(query: str, params: tuple = ()) -> int:
    if db_pool is None:
        raise RuntimeError('Database pool is not initialized')
    async with db_pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cur:
            await cur.execute(query, params)
            last_id = cur.lastrowid or 0
            await conn.commit()
            return last_id

async def init_db(conn: aiomysql.Connection):
    async with conn.cursor() as cur:
        # users
        await cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        # health_profiles
        await cur.execute(
            """
            CREATE TABLE IF NOT EXISTS health_profiles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                sleep_pattern VARCHAR(64) NOT NULL,
                sleep_hours INT NOT NULL,
                hydration_level VARCHAR(64) NOT NULL,
                stress_level VARCHAR(64) NOT NULL,
                exercise_frequency VARCHAR(64) NOT NULL,
                diet_type VARCHAR(64) NOT NULL,
                existing_conditions TEXT NULL,
                lifestyle_notes TEXT NULL,
                health_persona TEXT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        # timeline_entries
        await cur.execute(
            """
            CREATE TABLE IF NOT EXISTS timeline_entries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                entry_type VARCHAR(64) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NULL,
                severity INT NULL,
                tags JSON,
                timestamp DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        # chat_messages
        await cur.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                role VARCHAR(16) NOT NULL,
                content LONGTEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        # challenges
        await cur.execute(
            """
            CREATE TABLE IF NOT EXISTS challenges (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                challenge_type VARCHAR(64) NOT NULL,
                duration_days INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                start_date DATETIME NOT NULL,
                end_date DATETIME NOT NULL,
                completed_days INT NOT NULL,
                is_active BOOLEAN NOT NULL,
                is_completed BOOLEAN NOT NULL,
                badges JSON,
                check_ins JSON,
                created_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        # reminders
        await cur.execute(
            """
            CREATE TABLE IF NOT EXISTS reminders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                reminder_type VARCHAR(64) NOT NULL,
                frequency_hours INT NOT NULL,
                message TEXT NOT NULL,
                is_sarcastic BOOLEAN NOT NULL,
                is_active BOOLEAN NOT NULL,
                last_sent DATETIME NULL,
                created_at DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        # body_map_entries
        await cur.execute(
            """
            CREATE TABLE IF NOT EXISTS body_map_entries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                body_part VARCHAR(128) NOT NULL,
                pain_level INT NOT NULL,
                description TEXT NULL,
                analysis LONGTEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        )
        await conn.commit()

def to_dt(dt: datetime) -> datetime:
    # Ensures datetime is naive UTC for MySQL compatibility
    if isinstance(dt, datetime):
        return dt.replace(tzinfo=None)
    return dt

async def gemini_generate(system_message: str, user_text: str) -> str:
    try:
        model = genai.GenerativeModel(model_name=GEMINI_MODEL, system_instruction=system_message)
        resp = await model.generate_content_async(user_text)
        return (resp.text or "").strip()
    except Exception as e:
        logging.error(f"Gemini error: {e}")
        raise

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
    existing_user = await fetch_one("SELECT id FROM users WHERE username=%s", (user.username,))
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    # Hash password
    hashed_password = bcrypt.hash(user.password)

    # Create user
    created_at = to_dt(datetime.utcnow())
    await execute(
        "INSERT INTO users (username, email, password_hash, created_at) VALUES (%s, %s, %s, %s)",
        (user.username, user.email, hashed_password, created_at)
    )

    # Create token
    token = create_token(user.username)

    return TokenResponse(token=token, username=user.username)

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(user: UserLogin):
    # Find user
    user_doc = await fetch_one("SELECT id, password_hash FROM users WHERE username=%s", (user.username,))
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
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])
    
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
        response = await gemini_generate(
            "You are a creative health coach who creates fun, memorable health personas.",
            persona_prompt,
        )
        if response:
            health_persona = response
    except Exception as e:
        logging.error(f"Error generating persona: {e}")
    
    # Check if profile exists
    existing_profile = await fetch_one(
        "SELECT * FROM health_profiles WHERE user_id=%s",
        (user_id,)
    )

    now = to_dt(datetime.utcnow())
    if existing_profile:
        await execute(
            """
            UPDATE health_profiles
            SET sleep_pattern=%s, sleep_hours=%s, hydration_level=%s, stress_level=%s,
                exercise_frequency=%s, diet_type=%s, existing_conditions=%s, lifestyle_notes=%s,
                health_persona=%s, updated_at=%s
            WHERE user_id=%s
            """,
            (
                profile.sleep_pattern,
                profile.sleep_hours,
                profile.hydration_level,
                profile.stress_level,
                profile.exercise_frequency,
                profile.diet_type,
                profile.existing_conditions,
                profile.lifestyle_notes,
                health_persona,
                now,
                user_id,
            ),
        )
        profile_id = str(existing_profile["id"])  # return as str for compatibility
        created_at = existing_profile["created_at"]
        updated_at = now
    else:
        created_at = now
        profile_id_int = await execute(
            """
            INSERT INTO health_profiles (
                user_id, sleep_pattern, sleep_hours, hydration_level, stress_level,
                exercise_frequency, diet_type, existing_conditions, lifestyle_notes,
                health_persona, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                profile.sleep_pattern,
                profile.sleep_hours,
                profile.hydration_level,
                profile.stress_level,
                profile.exercise_frequency,
                profile.diet_type,
                profile.existing_conditions,
                profile.lifestyle_notes,
                health_persona,
                created_at,
                created_at,
            ),
        )
        profile_id = str(profile_id_int)
        updated_at = created_at

    return HealthProfileResponse(
        id=profile_id,
        user_id=str(user_id),
        sleep_pattern=profile.sleep_pattern,
        sleep_hours=profile.sleep_hours,
        hydration_level=profile.hydration_level,
        stress_level=profile.stress_level,
        exercise_frequency=profile.exercise_frequency,
        diet_type=profile.diet_type,
        existing_conditions=profile.existing_conditions,
        lifestyle_notes=profile.lifestyle_notes,
        health_persona=health_persona,
        created_at=created_at,
        updated_at=updated_at,
    )

@api_router.get("/health/profile", response_model=Optional[HealthProfileResponse])
async def get_health_profile(username: str = Depends(verify_token)):
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])
    profile = await fetch_one("SELECT * FROM health_profiles WHERE user_id=%s", (user_id,))

    if not profile:
        return None

    return HealthProfileResponse(
        id=str(profile["id"]),
        user_id=str(profile["user_id"]),
        sleep_pattern=profile["sleep_pattern"],
        sleep_hours=profile["sleep_hours"],
        hydration_level=profile["hydration_level"],
        stress_level=profile["stress_level"],
        exercise_frequency=profile["exercise_frequency"],
        diet_type=profile["diet_type"],
        existing_conditions=profile.get("existing_conditions"),
        lifestyle_notes=profile.get("lifestyle_notes"),
        health_persona=profile.get("health_persona"),
        created_at=profile["created_at"],
        updated_at=profile["updated_at"],
    )

# ==================== TIMELINE ENDPOINTS ====================

@api_router.post("/timeline/entry", response_model=TimelineEntryResponse)
async def create_timeline_entry(
    entry: TimelineEntryCreate,
    username: str = Depends(verify_token)
):
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    ts = to_dt(datetime.utcnow())
    tags_json = json.dumps(entry.tags or [])
    new_id = await execute(
        """
        INSERT INTO timeline_entries (user_id, entry_type, title, description, severity, tags, timestamp)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            entry.entry_type,
            entry.title,
            entry.description,
            entry.severity,
            tags_json,
            ts,
        ),
    )

    return TimelineEntryResponse(
        id=str(new_id),
        user_id=str(user_id),
        entry_type=entry.entry_type,
        title=entry.title,
        description=entry.description,
        severity=entry.severity,
        tags=entry.tags or [],
        timestamp=ts,
    )

@api_router.get("/timeline/entries", response_model=List[TimelineEntryResponse])
async def get_timeline_entries(
    limit: int = 50,
    username: str = Depends(verify_token)
):
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    rows = await fetch_all(
        "SELECT * FROM timeline_entries WHERE user_id=%s ORDER BY timestamp DESC LIMIT %s",
        (user_id, int(limit)),
    )
    results: List[TimelineEntryResponse] = []
    for r in rows:
        try:
            tags = json.loads(r.get("tags") or "[]")
        except Exception:
            tags = []
        results.append(
            TimelineEntryResponse(
                id=str(r["id"]),
                user_id=str(r["user_id"]),
                entry_type=r["entry_type"],
                title=r["title"],
                description=r.get("description"),
                severity=r.get("severity"),
                tags=tags,
                timestamp=r["timestamp"],
            )
        )
    return results

# ==================== CHAT ENDPOINTS ====================

@api_router.post("/chat/message", response_model=ChatMessageResponse)
async def send_chat_message(
    message: ChatMessageCreate,
    username: str = Depends(verify_token)
):
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    # Get user's health profile for context
    profile = await fetch_one("SELECT * FROM health_profiles WHERE user_id=%s", (user_id,))

    # Get recent timeline entries for context
    recent_entries = await fetch_all(
        "SELECT entry_type, title FROM timeline_entries WHERE user_id=%s ORDER BY timestamp DESC LIMIT 10",
        (user_id,),
    )
    
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
    user_ts = to_dt(datetime.utcnow())
    await execute(
        "INSERT INTO chat_messages (user_id, role, content, timestamp) VALUES (%s, %s, %s, %s)",
        (user_id, "user", message.message, user_ts),
    )
    
    # Get AI response
    try:
        response = await gemini_generate(context, message.message)

        # Save assistant message
        assistant_ts = to_dt(datetime.utcnow())
        await execute(
            "INSERT INTO chat_messages (user_id, role, content, timestamp) VALUES (%s, %s, %s, %s)",
            (user_id, "assistant", response, assistant_ts),
        )

        return ChatMessageResponse(
            role="assistant",
            content=response,
            timestamp=assistant_ts,
        )
    except Exception as e:
        logging.error(f"Error in chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to get AI response")

@api_router.get("/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(
    limit: int = 50,
    username: str = Depends(verify_token)
):
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    rows = await fetch_all(
        "SELECT role, content, timestamp FROM chat_messages WHERE user_id=%s ORDER BY timestamp ASC LIMIT %s",
        (user_id, int(limit)),
    )

    return ChatHistoryResponse(
        messages=[
            ChatMessageResponse(
                role=row["role"], content=row["content"], timestamp=row["timestamp"]
            )
            for row in rows
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
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])
    
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
    
    new_id = await execute(
        """
        INSERT INTO challenges (
            user_id, challenge_type, duration_days, title, description, start_date, end_date,
            completed_days, is_active, is_completed, badges, check_ins, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            challenge.challenge_type,
            challenge.duration_days,
            challenge.title,
            challenge.description,
            start_date,
            end_date,
            0,
            True,
            False,
            json.dumps([]),
            json.dumps([]),
            start_date,
        ),
    )

    return ChallengeResponse(
        id=str(new_id),
        user_id=str(user_id),
        challenge_type=challenge.challenge_type,
        duration_days=challenge.duration_days,
        title=challenge.title,
        description=challenge.description,
        start_date=start_date,
        end_date=end_date,
        completed_days=0,
        is_active=True,
        is_completed=False,
        badges=[],
        created_at=start_date,
    )

@api_router.get("/challenges/active", response_model=List[ChallengeResponse])
async def get_active_challenges(username: str = Depends(verify_token)):
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    rows = await fetch_all(
        "SELECT * FROM challenges WHERE user_id=%s AND is_active=1",
        (user_id,),
    )
    results: List[ChallengeResponse] = []
    for c in rows:
        try:
            badges = json.loads(c.get("badges") or "[]")
        except Exception:
            badges = []
        results.append(
            ChallengeResponse(
                id=str(c["id"]),
                user_id=str(c["user_id"]),
                challenge_type=c["challenge_type"],
                duration_days=c["duration_days"],
                title=c["title"],
                description=c["description"],
                start_date=c["start_date"],
                end_date=c["end_date"],
                completed_days=c["completed_days"],
                is_active=bool(c["is_active"]),
                is_completed=bool(c["is_completed"]),
                badges=badges,
                created_at=c["created_at"],
            )
        )
    return results

@api_router.post("/challenges/checkin")
async def challenge_checkin(
    checkin: ChallengeCheckIn,
    username: str = Depends(verify_token)
):
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    try:
        challenge_id_int = int(checkin.challenge_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid challenge ID")

    challenge = await fetch_one(
        "SELECT * FROM challenges WHERE id=%s AND user_id=%s",
        (challenge_id_int, user_id),
    )

    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    
    # Add check-in
    completed_days = int(challenge["completed_days"]) + 1
    check_ins = []
    try:
        check_ins = json.loads(challenge.get("check_ins") or "[]")
    except Exception:
        check_ins = []
    check_in_data = {
        "date": datetime.utcnow().isoformat(),
        "notes": checkin.notes,
    }
    check_ins.append(check_in_data)

    # Award badges
    try:
        badges = json.loads(challenge.get("badges") or "[]")
    except Exception:
        badges = []
    if completed_days == 3 and "3_day_streak" not in badges:
        badges.append("3_day_streak")
    if completed_days == 7 and "week_warrior" not in badges:
        badges.append("week_warrior")
    if completed_days >= int(challenge["duration_days"]):
        badges.append("challenge_completed")
    
    is_completed = completed_days >= int(challenge["duration_days"])

    await execute(
        """
        UPDATE challenges
        SET completed_days=%s, is_completed=%s, is_active=%s, badges=%s, check_ins=%s
        WHERE id=%s
        """,
        (
            completed_days,
            int(is_completed),
            int(not is_completed),
            json.dumps(badges),
            json.dumps(check_ins),
            challenge_id_int,
        ),
    )
    
    # Generate AI feedback
    try:
        prompt = (
            f"User completed day {completed_days} of {challenge['duration_days']} in their {challenge['title']} "
            f"challenge. Give them a brief motivating message (1-2 sentences)."
        )
        feedback = await gemini_generate(
            "You are an encouraging fitness coach. Give brief, motivating feedback.",
            prompt,
        )
        if not feedback:
            feedback = "Great job! Keep up the momentum!"
    except Exception:
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
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    # Get user's health profile for context
    profile = await fetch_one("SELECT * FROM health_profiles WHERE user_id=%s", (user_id,))

    # Get recent symptoms
    recent_symptoms = await fetch_all(
        "SELECT title FROM timeline_entries WHERE user_id=%s AND entry_type='symptom' ORDER BY timestamp DESC LIMIT 5",
        (user_id,),
    )
    
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
        prompt = f"""Based on this information: {context}

Provide:
1. Possible causes (2-3 common reasons)
2. Safe home remedies (2-3 suggestions)
3. When to see a doctor (warning signs)

Keep it concise and easy to understand. Remember this is general information, not medical advice."""

        analysis = await gemini_generate(
            "You are a helpful health advisor. Provide general health information, not medical diagnosis.",
            prompt,
        )

        # Save to database
        ts = to_dt(datetime.utcnow())
        await execute(
            """
            INSERT INTO body_map_entries (user_id, body_part, pain_level, description, analysis, timestamp)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (user_id, symptom.body_part, symptom.pain_level, symptom.description, analysis, ts),
        )

        return {
            "body_part": symptom.body_part,
            "analysis": analysis,
            "affected_areas": [symptom.body_part],  # Could expand to related areas
            "severity": "high" if symptom.pain_level >= 4 else "moderate" if symptom.pain_level >= 2 else "low",
        }
    except Exception as e:
        logging.error(f"Error analyzing symptom: {e}")
        raise HTTPException(status_code=500, detail="Failed to analyze symptom")

# ==================== INSIGHTS ENDPOINTS ====================

@api_router.get("/insights/patterns")
async def get_health_patterns(username: str = Depends(verify_token)):
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    # Get timeline entries from last 30 days
    thirty_days_ago = to_dt(datetime.utcnow() - timedelta(days=30))
    entries = await fetch_all(
        "SELECT * FROM timeline_entries WHERE user_id=%s AND timestamp >= %s",
        (user_id, thirty_days_ago),
    )
    
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
        prompt = f"""Analyze this health data from the last 30 days:
- Symptoms logged: {symptom_count}
- Mood entries: {len(mood_entries)}
- Sleep tracking: {len(sleep_entries)}
- Hydration logs: {len(hydration_entries)}

Provide 2-3 brief, actionable insights or predictions. Be encouraging but realistic."""
        ai_insights = await gemini_generate(
            "You are a health data analyst. Provide brief, actionable insights.",
            prompt,
        )
    except Exception:
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
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    created_at = to_dt(datetime.utcnow())
    new_id = await execute(
        """
        INSERT INTO reminders (user_id, reminder_type, frequency_hours, message, is_sarcastic, is_active, last_sent, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            user_id,
            reminder.reminder_type,
            reminder.frequency_hours,
            reminder.message,
            int(reminder.is_sarcastic),
            1,
            None,
            created_at,
        ),
    )

    return ReminderResponse(
        id=str(new_id),
        user_id=str(user_id),
        reminder_type=reminder.reminder_type,
        frequency_hours=reminder.frequency_hours,
        message=reminder.message,
        is_sarcastic=reminder.is_sarcastic,
        is_active=True,
        last_sent=None,
        created_at=created_at,
    )

@api_router.get("/reminders/active", response_model=List[ReminderResponse])
async def get_active_reminders(username: str = Depends(verify_token)):
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    rows = await fetch_all(
        "SELECT * FROM reminders WHERE user_id=%s AND is_active=1",
        (user_id,),
    )
    results: List[ReminderResponse] = []
    for r in rows:
        results.append(
            ReminderResponse(
                id=str(r["id"]),
                user_id=str(r["user_id"]),
                reminder_type=r["reminder_type"],
                frequency_hours=r["frequency_hours"],
                message=r["message"],
                is_sarcastic=bool(r["is_sarcastic"]),
                is_active=bool(r["is_active"]),
                last_sent=r.get("last_sent"),
                created_at=r["created_at"],
            )
        )
    return results

@api_router.post("/reminders/{reminder_id}/toggle")
async def toggle_reminder(
    reminder_id: str,
    username: str = Depends(verify_token)
):
    user = await fetch_one("SELECT id FROM users WHERE username=%s", (username,))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = int(user["id"])

    try:
        reminder_id_int = int(reminder_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid reminder ID")

    reminder = await fetch_one(
        "SELECT is_active FROM reminders WHERE id=%s AND user_id=%s",
        (reminder_id_int, user_id),
    )

    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")

    new_status = not bool(reminder["is_active"])
    await execute(
        "UPDATE reminders SET is_active=%s WHERE id=%s",
        (int(new_status), reminder_id_int),
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

@app.on_event("startup")
async def on_startup():
    global db_pool
    db_pool = await ensure_database_pool()
    # Initialize tables
    async with db_pool.acquire() as conn:
        await init_db(conn)

@app.on_event("shutdown")
async def shutdown_db_client():
    global db_pool
    if db_pool is not None:
        db_pool.close()
        await db_pool.wait_closed()
