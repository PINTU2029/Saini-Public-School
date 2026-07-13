"""
School Management App Backend
FastAPI + MongoDB + JWT Auth
Roles: student, parent, teacher, admin
"""
import os
import httpx
import logging
import uuid
import bcrypt
import jwt
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Literal, Dict, Any

from enum import Enum

import hmac
import hashlib
import razorpay

                                    
import random                                  
import smtplib  
from groq import Groq                                
                  
from email.mime.multipart import MIMEMultipart   
from email.mime.text import MIMEText             


from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request , status 
from contextlib import asynccontextmanager
from fastapi.responses import StreamingResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr,  model_validator
from dotenv import load_dotenv
from google import genai
import google.generativeai as legacy_genai

try:
    from google import genai
    from google.genai import types
except ImportError:
    # Fallback to prevent absolute startup collapse if packages are syncing
    genai = None

# --- ENV CONFIG ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# --- DATABASE CONFIG ---
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# --- AUTH CONFIG ---
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "168"))

# --- CORE INTEGRATIONS ---
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ⚡ Dynamic Client Initialization for Chatbot using modern SDK syntax
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_KEY:
    legacy_genai.configure(api_key=GEMINI_KEY)

app = FastAPI(title="School Management App")

# ⚡ FASTAPI CORSMIDDLEWARE SETUP: Standard structure that automatically maps dynamic routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("school")

Role = Literal["student", "parent", "teacher", "admin"]


# ---------- HELPERS ----------
def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid.uuid4().hex


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": utcnow() + timedelta(hours=JWT_EXPIRE_HOURS),
        "iat": utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_roles(*roles: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {', '.join(roles)}")
        return user
    return _dep


def clean_doc(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ---------- MODELS ----------
class LoginIn(BaseModel):
    email: EmailStr
    password: str



# 👥 Roles definition 
class Role(str, Enum):
    admin = "admin"
    teacher = "teacher"
    student = "student"
    parent = "parent"

# 📝 MAIN REGISTRATION MODEL SCHEMA
class RegisterIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)
    role: Role
    class_id: Optional[str] = Field(None, description="Class from 1 to 12 for students")
    bus_facility: bool = Field(False, description="Whether student opted for transport facility")

    # 🔒 Strict Password & Confirm Password Match Validator
    @model_validator(mode='after')
    def check_passwords_match(self) -> 'RegisterIn':
        pw = self.password
        cpw = self.confirm_password
        if pw is not None and cpw is not None and pw != cpw:
            raise ValueError('passwords do not match')
        return self


# 📧 NEW: OTP INITIAL REQUEST SCHEMA
class OTPRequestIn(BaseModel):
    email: EmailStr


# 🔑 NEW: OTP VERIFICATION REQUEST SCHEMA
class OTPVerifyIn(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6, description="6-Digit Verification PIN")



class UserOut(BaseModel):
    user_id: str
    email: str
    name: str
    role: str
    class_id: Optional[str] = None
    child_ids: Optional[List[str]] = None
    subject: Optional[str] = None
    avatar_url: Optional[str] = None
    roll_no: Optional[str] = None
    guardian_phone: Optional[str] = None


class TokenOut(BaseModel):
    token: str
    user: UserOut


class AttendanceMarkIn(BaseModel):
    class_id: str
    date: str  # YYYY-MM-DD
    entries: List[Dict[str, str]]  # [{student_id, status: present|absent|late}]


class HomeworkIn(BaseModel):
    class_id: str
    subject: str
    title: str
    description: str
    due_date: str
    attachment_base64: Optional[str] = None
    attachment_name: Optional[str] = None


class NoticeIn(BaseModel):
    title: str
    body: str
    category: str = "general"  # general, holiday, event, urgent
    target_role: str = "all"  # all, student, parent, teacher


class FeeItemIn(BaseModel):
    student_id: str
    title: str
    amount: float
    due_date: str


class FeePayIn(BaseModel):
    fee_id: str


class ReportCardIn(BaseModel):
    student_id: str
    term: str  # e.g., "Term 1 - 2026"
    subjects: List[Dict[str, Any]]  # [{name, marks, max_marks, grade}]
    remarks: str = ""


class FacultyAddIn(BaseModel):
    name: str
    designation: str  # e.g., "HOD - Mathematics", "Science Teacher"
    qualification: str  # e.g., "B.Ed, M.Sc in Physics"
    photo_url: str = ""  
    about: str = ""  

class FacultyEditIn(BaseModel):
    name: Optional[str] = None
    designation: Optional[str] = None
    qualification: Optional[str] = None
    photo_url: Optional[str] = None
    about: Optional[str] = None

class TimetableIn(BaseModel):
    class_id: str
    day: str  # Monday..Saturday
    periods: List[Dict[str, str]]  # [{time, subject, teacher}]


class LeaveIn(BaseModel):
    student_id: str
    from_date: str
    to_date: str
    reason: str


class LeaveActionIn(BaseModel):
    leave_id: str
    action: Literal["approve", "reject"]


class BusLocationIn(BaseModel):
    bus_id: str
    lat: float
    lng: float
    speed: float
    next_stop: str
    eta_minutes: int
    route_from: str = "Saini School, Baharawanda" # ⚡ Default settings fallback matching route start
    route_to: str = "Dausa" # ⚡ Default settings target destination match


class RfidCheckinIn(BaseModel):
    student_id: str
    location: str  # gate, bus


class LmsIn(BaseModel):
    title: str
    subject: str
    class_id: str
    kind: Literal["video", "pdf", "notes"]
    url: Optional[str] = None
    content_base64: Optional[str] = None
    description: str = ""


class GalleryAlbumIn(BaseModel):
    title: str = Field(..., description="Album or Event Title")
    event_date: str = Field(..., description="Date of the event (YYYY-MM-DD)")
    photos_base64: List[str] = Field(..., description="Array of base64 encoded images from device storage")
    class_id: Optional[str] = Field(None, description="Optional class filter restriction tag")

    class Config:
        json_schema_extra = {
            "example": {
                "title": "Annual Sports Day 2026",
                "event_date": "2026-07-15",
                "photos_base64": ["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="],
                "class_id": "10"
            }
        }


class ChatSendIn(BaseModel):
    to_user_id: str
    body: str


class ChatbotIn(BaseModel):
    session_id: str
    message: str
    language: Literal["en", "hi"] = "en"



# ---------- AUTH ROUTES ----------



# ==========================================
# ⚡ BLOCK 1: SMTP EMAIL SENDER + SEND REGISTER OTP ENDPOINT
# ==========================================

# 📧 SECURITY CONFIG FROM .ENV (Ensure parameters exist in your environment)
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SENDER_EMAIL = os.environ.get("SMTP_SENDER_EMAIL", "")
SENDER_PASSWORD = os.environ.get("SMTP_SENDER_PASSWORD", "")

def send_otp_email(receiver_email: str, otp: str):
    try:
        html_content = f"""
        <html>
            <body style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #047857;">Welcome to Saini Public School!</h2>
                <p>Your secure verification code (OTP) is:</p>
                <h1 style="background: #f0fdf4; padding: 10px; display: inline-block; letter-spacing: 2px; color: #166534;">{otp}</h1>
                <p>This code is valid for 10 minutes. Please do not share it with anyone.</p>
            </body>
        </html>
        """

        # 🔒 Purely dynamic fetching from your .env / Render Environment Config
        WEB3FORMS_KEY = os.environ.get("WEB3FORMS_ACCESS_KEY", "")

        # Proper JSON and Accept headers to prevent 403 Forbidden on backend calls
        response = httpx.post(
            "https://api.web3forms.com/submit",
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            json={
                "access_key": WEB3FORMS_KEY,
                "from_name": "Saini Public School",
                "subject": "Saini Public School - Email Verification OTP",
                "to": receiver_email,
                "html": html_content
            },
            timeout=12.0
        )
        
        print(f"Web3Forms Dispatch Status: {response.status_code}")
        print(f"Web3Forms Response: {response.text}")
        
        if response.status_code == 200:
            return True
        else:
            return False

    except Exception as e:
        print(f"Mail Pipeline Exception: {str(e)}")
        raise Exception("Failed to send email via Cloud API network gateway.")
    
    
@api.post("/auth/send-otp")
async def send_registration_otp(inp: OTPRequestIn):
    email = inp.email.lower().strip()
    
    # Check regular users collection first
    if await db.users.find_one({"email": email}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, 
            detail="Email already registered"
        )
        
    # Generate 6-digit random code string
    otp_code = str(random.randint(100000, 999999))
    
    # Store temporal token states inside otp collection
    await db.otp_verifications.update_one(
        {"email": email},
        {
            "$set": {
                "otp": otp_code,
                "verified": False,
                "created_at": utcnow().isoformat()
            }
        },
        upsert=True
    )
    
    # Secure API utility pipeline activation trigger
    if send_otp_email(email, otp_code):
        return {"status": "success", "message": "Verification OTP sent to your email."}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to send email. Check WEB3FORMS_ACCESS_KEY configuration."
        )
    
    
# ==========================================
# ⚡ BLOCK 2: VERIFY REGISTER OTP ENDPOINT
# ==========================================
@api.post("/auth/verify-otp")
async def verify_registration_otp(inp: OTPVerifyIn):
    email = inp.email.lower().strip()
    record = await db.otp_verifications.find_one({"email": email})
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="No verification record found. Please request a new OTP."
        )
        
    if record["otp"] == inp.otp.strip():
        # Set verified state lock toggle to true
        await db.otp_verifications.update_one(
            {"email": email},
            {"$set": {"verified": True}}
        )
        return {"status": "success", "message": "Email verified successfully!"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Invalid OTP code entered."
        )


# ==========================================
# ⚡ BLOCK 3: FINAL REGISTER (With Verification Barrier)
# ==========================================
@api.post("/auth/register", response_model=TokenOut)
async def register(inp: RegisterIn):
    # Password Match Validation
    if inp.password != inp.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Password and Confirm Password do not match"
        )

    email = inp.email.lower().strip()

    # 🛡️ SECURITY BARRIER: Enforce email verification check before processing DB document inserts
    otp_check = await db.otp_verifications.find_one({"email": email})
    if not otp_check or not otp_check.get("verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address verification pending. Please verify via OTP first."
        )

    # Email Exists
    if await db.users.find_one({"email": email}):
        raise HTTPException(
            status_code=409,
            detail="Email already registered"
        )

    user_id = new_id()

    # Role check ke hisab se class_id allocate karna
    final_class_id = inp.class_id if inp.role == "student" else None

    doc = {
        "user_id": user_id,
        "email": email,
        "password": hash_password(inp.password),
        "name": inp.name.strip(),
        "role": inp.role,
        "class_id": final_class_id,
        "child_ids": [],
        "subject": None,
        "avatar_url": None,
        "bus_facility": inp.bus_facility if inp.role == "student" else False,
        "created_at": utcnow().isoformat(),
    }

    await db.users.insert_one(doc)

    # 🛡️ Clean up verification state record logs
    await db.otp_verifications.delete_one({"email": email})

    # 🔹 FEES AUTOMATION LOGIC FOR STUDENTS
    if inp.role == "student" and final_class_id:
        master_fee = await db.fees_structure.find_one({"class_id": final_class_id})
        fee_amount = master_fee["amount"] if master_fee else 5000 
        
        fee_doc = {
            "fee_id": new_id(),
            "student_id": user_id,
            "class_id": final_class_id,
            "amount": float(fee_amount),
            "title": f"Academic Tuition Fee - Class {final_class_id}",
            "status": "pending",  
            "created_at": utcnow().isoformat()
        }
        await db.fees.insert_one(fee_doc)

        if inp.bus_facility:
            bus_fee_doc = {
                "fee_id": new_id(),
                "student_id": user_id,
                "class_id": final_class_id,
                "amount": 3200.0,  
                "title": "Bus Fee - Q1",
                "status": "pending",
                "created_at": utcnow().isoformat()
            }
            await db.fees.insert_one(bus_fee_doc)

    user = doc.copy()
    user.pop("password", None)
    user.pop("_id", None)

    token = create_token(user_id, inp.role)

    return {
        "token": token,
        "user": UserOut(**user)
    }



@api.post("/auth/login", response_model=TokenOut)
async def login(inp: LoginIn):
    # ⚡ User input security wrapper: Email ko strict lowercase trim check karenge
    email_clean = inp.email.strip().lower()
    user = await db.users.find_one({"email": email_clean})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # ⚡ Password validation safety hook
    if not verify_password(inp.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    # JWT Generation
    token = create_token(user["user_id"], user["role"])
    
    # Clean dictionary data before parsing to Pydantic Model
    user_data = dict(user)
    user_data.pop("password", None)
    user_data.pop("_id", None)
    
    return {"token": token, "user": UserOut(**user_data)}


@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    user_data = dict(user)
    user_data.pop("password", None)
    user_data.pop("_id", None)
    return UserOut(**user_data)

# ---------- USERS ----------
@api.get("/users")
async def list_users(role: Optional[str] = None, class_id: Optional[str] = None,
                    user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if role:
        q["role"] = role
    if class_id:
        q["class_id"] = class_id
    docs = await db.users.find(q, {"_id": 0, "password": 0}).to_list(500)
    return docs


@api.get("/classes")
async def list_classes(user: dict = Depends(get_current_user)):
    docs = await db.classes.find({}, {"_id": 0}).to_list(200)
    return docs



# ---------- ATTENDANCE ----------
@api.post("/attendance/mark")
async def attendance_mark(inp: AttendanceMarkIn, user: dict = Depends(require_roles("teacher", "admin"))):
    clean_class_id = str(inp.class_id).replace("cls_", "").strip()
    
    for entry in inp.entries:
        clean_student_id = str(entry["student_id"]).replace("std_", "").strip()
        
        await db.attendance.update_one(
            {"student_id": clean_student_id, "date": inp.date},
            {"$set": {
                "student_id": clean_student_id,
                "class_id": clean_class_id,
                "date": inp.date,
                "status": entry.get("status", "present"), # Frontend se ab "holiday" bhi safely aayega
                "marked_by": user["user_id"],
                "marked_at": utcnow().isoformat(),
            }},
            upsert=True,
        )
    return {"ok": True, "count": len(inp.entries)}


@api.get("/attendance/student/{student_id}")
async def attendance_by_student(student_id: str, month: Optional[str] = None, user: dict = Depends(get_current_user)):
    clean_student_id = str(student_id).replace("std_", "").strip()
    
    q: Dict[str, Any] = {"student_id": clean_student_id}
    if month:  # YYYY-MM
        q["date"] = {"$regex": f"^{month}"}
        
    records = await db.attendance.find(q, {"_id": 0}).sort("date", -1).to_list(200)
    
    total = len(records)
    present = sum(1 for r in records if r["status"] == "present")
    late = sum(1 for r in records if r["status"] == "late")
    absent = sum(1 for r in records if r["status"] == "absent")
    holiday = sum(1 for r in records if r["status"] == "holiday") #  NEW: Holidays track karne ke liye
    
    #  FIX: Total dynamic working days nikalne ke liye total me se holidays minus kiye
    # Taaki percentage chuttiyon ki wajah se kam na dikhaye
    working_days = total - holiday
    
    pct = round((present + late * 0.5) / working_days * 100, 1) if working_days else 0.0
    
    return {
        "records": records, 
        "total": total, 
        "present": present, 
        "absent": absent, 
        "late": late, 
        "holiday": holiday, # Response me total holidays bhi return kar diye
        "percentage": pct
    }


@api.get("/attendance/class/{class_id}")
async def attendance_by_class(class_id: str, date: str, user: dict = Depends(require_roles("teacher", "admin"))):
    clean_class_id = str(class_id).replace("cls_", "").strip()

    try:
        class_num = int(clean_class_id)
        if not (1 <= class_num <= 12):
            raise HTTPException(status_code=400, detail="Class must be between 1 and 12")
    except ValueError:
        pass 

    try:
        int_class_id = int(clean_class_id)
        class_filter_values = [clean_class_id, int_class_id]
    except ValueError:
        class_filter_values = [clean_class_id]

    students_in_class = await db.users.find(
        {
            "role": "student", 
            "class_id": {"$in": class_filter_values}
        },
        {"_id": 0, "user_id": 1, "name": 1, "roll_no": 1}
    ).to_list(200)

    target_month = date[:7]

    existing_records = await db.attendance.find(
        {
            "class_id": {"$in": class_filter_values}, 
            "date": {"$regex": f"^{target_month}"}
        }, 
        {"_id": 0}
    ).to_list(2000)

    merged_sheet = []
    for s in students_in_class:
        s_id = str(s["user_id"])
        
        student_data = {
            "student_id": s_id,
            "name": s["name"],
            "roll_no": s.get("roll_no"),
            "class_id": clean_class_id,
            "monthly_records": {}
        }
        
        for r in existing_records:
            if str(r["student_id"]) == s_id:
                student_data["monthly_records"][r["date"]] = r["status"]
                
        merged_sheet.append(student_data)

    return merged_sheet


# ---------- HOMEWORK ----------
@api.post("/homework")
async def homework_create(inp: HomeworkIn, user: dict = Depends(require_roles("teacher", "admin"))):
    hid = new_id()
    
    #  FIX: String cleaner logic handles formatting ("cls_10" -> "10")
    clean_class_id = str(inp.class_id).replace("cls_", "").strip() if inp.class_id else ""
    
    doc = {
        "homework_id": hid,
        "class_id": clean_class_id,
        "subject": inp.subject,
        "title": inp.title,
        "description": inp.description,
        "due_date": inp.due_date,
        "attachment_base64": inp.attachment_base64,
        "attachment_name": inp.attachment_name,
        "posted_by": user["user_id"],
        "posted_by_name": user["name"],
        "created_at": utcnow().isoformat(),
    }
    await db.homework.insert_one(doc)
    return clean_doc(doc)


@api.get("/homework")
async def homework_list(class_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    
    #  FIX: Fetch request string parameter adjustments
    if class_id:
        q["class_id"] = str(class_id).replace("cls_", "").strip()
    elif user["role"] == "student":
        # Check student account settings validation
        student_class = user.get("class_id")
        if student_class:
            q["class_id"] = str(student_class).replace("cls_", "").strip()
        else:
            # Safe boundary check constraint block if student has no class attached
            return []
            
    docs = await db.homework.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs

# ---------- NOTICES ----------
@api.post("/notices")
async def notice_create(inp: NoticeIn, user: dict = Depends(require_roles("teacher", "admin"))):
    nid = new_id()
    doc = {
        "notice_id": nid,
        "title": inp.title,
        "body": inp.body,
        "category": inp.category,
        "target_role": inp.target_role,
        "posted_by": user["user_id"],
        "posted_by_name": user["name"],
        "created_at": utcnow().isoformat(),
    }
    await db.notices.insert_one(doc)
    return clean_doc(doc)


@api.get("/notices")
async def notice_list(user: dict = Depends(get_current_user)):
    q = {"$or": [{"target_role": "all"}, {"target_role": user["role"]}]}
    docs = await db.notices.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs


# ---------- FEES bY ROZORPAY----------


#  Environment variables load karne ke liye
load_dotenv()

#  Razorpay Client Initialization via .env (100% Secure)
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")

if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
    raise RuntimeError("Razorpay Keys are missing inside the backend .env file!")

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

# --- Pydantic Schemas for Razorpay ---
class RazorpayOrderIn(BaseModel):
    fee_id: str

class RazorpayVerifyIn(BaseModel):
    fee_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

# ---------- FEES ----------
@api.post("/fees")
async def fee_create(inp: FeeItemIn, user: dict = Depends(require_roles("admin"))):
    fid = new_id()
    doc = {
        "fee_id": fid,
        "student_id": inp.student_id,
        "title": inp.title,
        "amount": inp.amount,
        "due_date": inp.due_date,
        "status": "pending",
        "created_at": utcnow().isoformat(),
    }
    await db.fees.insert_one(doc)
    return clean_doc(doc)


@api.get("/fees/student/{student_id}")
async def fees_by_student(student_id: str, user: dict = Depends(get_current_user)):
    docs = await db.fees.find({"student_id": student_id}, {"_id": 0}).sort("due_date", 1).to_list(200)
    return docs


# 💳 1. Razorpay Order Creation Endpoint
@api.post("/fees/razorpay/create-order")
async def create_razorpay_order(inp: RazorpayOrderIn, user: dict = Depends(get_current_user)):
    fee = await db.fees.find_one({"fee_id": inp.fee_id}, {"_id": 0})
    if not fee:
        raise HTTPException(status_code=404, detail="Fee item not found")
    if fee["status"] == "paid":
        raise HTTPException(status_code=400, detail="Fee is already paid")

    # Razorpay amount paise me leta hai (e.g., ₹3,200 = 320000 paise)
    amount_in_paise = int(float(fee["amount"]) * 100)
    receipt_id = f"rcpt_{inp.fee_id[:10]}"

    try:
        data = {
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": receipt_id,
            "payment_capture": 1
        }
        razorpay_order = client.order.create(data=data)
        
        # Temp reference order backup inside DB for verification sync
        await db.fees.update_one(
            {"fee_id": inp.fee_id},
            {"$set": {"razorpay_order_id": razorpay_order["id"]}}
        )

        return {
            "order_id": razorpay_order["id"],
            "amount": fee["amount"],
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID, # Frontend checkout script ko order populate karne ke liye chahiye
            "title": fee["title"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay Order Error: {str(e)}")


# 🔐 2. Razorpay Payment Signature Verification Endpoint
@api.post("/fees/razorpay/verify")
async def verify_razorpay_payment(inp: RazorpayVerifyIn, user: dict = Depends(get_current_user)):
    fee = await db.fees.find_one({"fee_id": inp.fee_id}, {"_id": 0})
    if not fee:
        raise HTTPException(status_code=404, detail="Fee record missing")

    # Server-side HMAC SHA256 Signature verification framework
    msg = f"{inp.razorpay_order_id}|{inp.razorpay_payment_id}"
    generated_signature = hmac.new(
        bytes(RAZORPAY_KEY_SECRET, "utf-8"),
        bytes(msg, "utf-8"),
        hashlib.sha256
    ).hexdigest()

    if generated_signature != inp.razorpay_signature:
        raise HTTPException(status_code=400, detail="Payment verification failed! Bad signature.")

    # Payment verify hone ke baad hi dynamic "paid" tag setup database me commit hoga
    receipt_id = "RCPT-" + new_id()[:10].upper()
    await db.fees.update_one(
        {"fee_id": inp.fee_id},
        {"$set": {
            "status": "paid",
            "paid_at": utcnow().isoformat(),
            "receipt_id": receipt_id,
            "paid_by": user["user_id"],
            "razorpay_payment_id": inp.razorpay_payment_id
        }},
    )
    return {"ok": True, "receipt_id": receipt_id, "amount": fee["amount"]}


@api.get("/fees/overview")
async def fees_overview(class_id: Optional[str] = None, status: Optional[str] = None,
                        user: dict = Depends(require_roles("admin", "teacher"))):
    q: Dict[str, Any] = {"role": "student"}
    if class_id:
        q["class_id"] = class_id
    students = await db.users.find(q, {"_id": 0, "password": 0}).to_list(1000)

    results = []
    total_students = 0
    total_pending_amount = 0.0
    total_paid_amount = 0.0
    fully_paid_count = 0
    has_pending_count = 0

    for s in students:
        fees = await db.fees.find({"student_id": s["user_id"]}, {"_id": 0}).sort("due_date", 1).to_list(200)
        paid_fees = [f for f in fees if f["status"] == "paid"]
        pending_fees = [f for f in fees if f["status"] == "pending"]
        paid_amt = sum(f["amount"] for f in paid_fees)
        pend_amt = sum(f["amount"] for f in pending_fees)

        student_status = "paid" if len(pending_fees) == 0 else "pending"
        if status and student_status != status:
            continue

        results.append({
            "student_id": s["user_id"],
            "name": s["name"],
            "roll_no": s.get("roll_no"),
            "class_id": s.get("class_id"),
            "email": s["email"],
            "guardian_phone": s.get("guardian_phone"),
            "status": student_status,
            "paid_amount": paid_amt,
            "pending_amount": pend_amt,
            "paid_count": len(paid_fees),
            "pending_count": len(pending_fees),
            "fees": fees,
        })
        total_students += 1
        total_pending_amount += pend_amt
        total_paid_amount += paid_amt
        if student_status == "paid":
            fully_paid_count += 1
        else:
            has_pending_count += 1

    results.sort(key=lambda r: (r["status"] != "pending", r["roll_no"] or ""))

    return {
        "summary": {
            "total_students": total_students,
            "fully_paid": fully_paid_count,
            "has_pending": has_pending_count,
            "total_paid_amount": total_paid_amount,
            "total_pending_amount": total_pending_amount,
        },
        "students": results,
    }




# ---------- REPORT CARD ----------

@api.get("/report-cards/view")
async def report_view(
    student_id: str = None, 
    class_id: str = None, 
    user: dict = Depends(get_current_user)
):
    """
    Master Open Access Endpoint: Student, Parent, Teacher ya Admin
    kisi bhi class ya student ka result bina kisi restriction ke dekh sakte hain.
    """
    query = {}

    #  Agar kisi specific student ka dekhna ho
    if student_id:
        clean_student_id = str(student_id).replace("std_", "").strip()
        query["student_id"] = clean_student_id

    #  Agar poori class ka result ek sath dekhna ho (e.g., Class 3, Class 10)
    if class_id:
        clean_class_id = str(class_id).replace("cls_", "").strip()
        query["class_id"] = clean_class_id

    # Database se find karenge, sorted by newest first
    docs = await db.report_cards.find(query).sort("created_at", -1).to_list(200)
    
    # Clean and return MongoDB documents safely
    return [clean_doc(d) for d in docs]


# ---------- 🏫 FACULTY DIRECTORY ROUTES ----------

@api.get("/faculties")
async def get_all_faculties():
    """
    Public Endpoint: Ise Student, Parent, Teacher, Admin sabhi dekh sakte hain
    taki menu me teachers ki list show ho sake.
    """
    try:
        # Collection se saari faculty ki list fetch karke short order me sort 
        docs = await db.faculties.find({}, {"_id": 0}).sort("name", 1).to_list(200)
        return docs
    except Exception as e:
        return []


@api.post("/faculty/add")
async def add_new_faculty(inp: FacultyAddIn, user: dict = Depends(get_current_user)):
    """
    Admin Only: Naya faculty profile add karne ke liye strict auth check.
    """
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sirf Admin hi faculty add kar sakte hain!")
        
    faculty_id = f"fac_{new_id()}"
    new_faculty = {
        "faculty_id": faculty_id,
        "name": inp.name,
        "designation": inp.designation,
        "qualification": inp.qualification,
        "photo_url": inp.photo_url,
        "about": inp.about,
        "created_at": utcnow().isoformat()
    }
    
    await db.faculties.insert_one(new_faculty)
    return {"status": "success", "message": "Faculty member successfully added!", "faculty": clean_doc(new_faculty)}


@api.put("/faculty/edit/{faculty_id}")
async def edit_faculty_details(faculty_id: str, inp: FacultyEditIn, user: dict = Depends(get_current_user)):
    """
    Admin Only: Kisi bhi existing faculty profile ko dynamically update karne ke liye.
    """
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sirf Admin hi faculty edit kar sakte hain!")
        
    # Check karenge ki wo faculty database me exist karti hai ya nahi
    existing = await db.faculties.find_one({"faculty_id": faculty_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Faculty member nahi mila!")
        
    # Pydantic model se sirf un fields ko uthayenge jo Admin ne bheje hain (Not None)
    update_data = {k: v for k, v in inp.dict(exclude_unset=True).items() if v is not None}
    
    if not update_data:
        return {"status": "success", "message": "Kuch update karne ke liye nahi mila."}
        
    await db.faculties.update_one({"faculty_id": faculty_id}, {"$set": update_data})
    return {"status": "success", "message": "Faculty details updated successfully!"}


@api.delete("/faculty/delete/{faculty_id}")
async def delete_faculty_member(faculty_id: str, user: dict = Depends(get_current_user)):
    """
    Admin Only: Kisi faculty profile ko list se permanently remove karne ke liye.
    """
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Sirf Admin hi faculty delete kar sakte hain!")
        
    result = await db.faculties.delete_one({"faculty_id": faculty_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Faculty member nahi mila!")
        
    return {"status": "success", "message": "Faculty member removed successfully!"}



# ---------- TIMETABLE ----------
@api.post("/timetable")
async def timetable_update(inp: TimetableIn, user: dict = Depends(require_roles("admin"))):
    # 👆 Yahan se "teacher" hata diya, ab sirf Admin hi update kar payega.
    
    # Frontend format cleanup handling ("cls_10a" to "10")
    clean_class_id = str(inp.class_id).replace("cls_", "")
    
    await db.timetable.update_one(
        {"class_id": clean_class_id, "day": inp.day},
        {"$set": {
            "class_id": clean_class_id, 
            "day": inp.day, 
            "periods": inp.periods,
            "updated_at": utcnow().isoformat()
        }},
        upsert=True,
    )
    return {"ok": True}


@api.get("/timetable/{class_id}")
async def timetable_get(class_id: str, user: dict = Depends(get_current_user)):
    # Frontend format compatibility fallback clean check
    clean_class_id = str(class_id).replace("cls_", "")
    
    docs = await db.timetable.find({"class_id": clean_class_id}, {"_id": 0}).to_list(10)
    order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    docs.sort(key=lambda d: order.index(d["day"]) if d["day"] in order else 99)
    return docs


# ---------- LEAVE ----------
@api.post("/leaves")
async def leave_create(inp: LeaveIn, user: dict = Depends(get_current_user)):
    lid = new_id()
    doc = {
        "leave_id": lid,
        "student_id": inp.student_id,
        "requested_by": user["user_id"],
        "requested_by_name": user["name"],
        "from_date": inp.from_date,
        "to_date": inp.to_date,
        "reason": inp.reason,
        "status": "pending",
        "created_at": utcnow().isoformat(),
    }
    await db.leaves.insert_one(doc)
    return clean_doc(doc)


@api.post("/leaves/action")
async def leave_action(inp: LeaveActionIn, user: dict = Depends(require_roles("teacher", "admin"))):
    result = await db.leaves.update_one(
        {"leave_id": inp.leave_id},
        {"$set": {"status": "approved" if inp.action == "approve" else "rejected",
                  "acted_by": user["user_id"], "acted_at": utcnow().isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Leave not found")
    return {"ok": True}


@api.get("/leaves")
async def leave_list(status: Optional[str] = None, student_id: Optional[str] = None,
                     user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if status:
        q["status"] = status
    if student_id:
        q["student_id"] = student_id
    docs = await db.leaves.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs





# ---------- BUS TRACKING ----------
@api.post("/bus/location")
async def bus_update(inp: BusLocationIn, user: dict = Depends(get_current_user)):
    #  Driver app se dynamic parameters capture karke update commit karega database pipeline me
    await db.buses.update_one(
        {"bus_id": inp.bus_id},
        {"$set": {
            "bus_id": inp.bus_id, 
            "lat": inp.lat, 
            "lng": inp.lng, 
            "speed": inp.speed,
            "next_stop": inp.next_stop, 
            "eta_minutes": inp.eta_minutes,
            "route_from": inp.route_from, # Baharawanda tracking check tag
            "route_to": inp.route_to,     # Dausa target check tag
            "updated_at": utcnow().isoformat()
        }},
        upsert=True,
    )
    return {"ok": True}


@api.get("/bus/{bus_id}")
async def bus_get(bus_id: str, user: dict = Depends(get_current_user)):
    doc = await db.buses.find_one({"bus_id": bus_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Bus not found")
        
    #  SAFETY INTERVENTION: Agar database me chije empty hai toh direct response inject framework dynamic standard set karega
    if "route_from" not in doc:
        doc["route_from"] = "Saini School, Baharawanda"
    if "route_to" not in doc:
        doc["route_to"] = "Dausa"
        
    return doc


@api.get("/bus")
async def bus_list(user: dict = Depends(get_current_user)):
    docs = await db.buses.find({}, {"_id": 0}).to_list(50)
    for doc in docs:
        if "route_from" not in doc:
            doc["route_from"] = "Saini School, Baharawanda"
        if "route_to" not in doc:
            doc["route_to"] = "Dausa"
    return docs


# ---------- RFID CHECK-IN ----------
@api.post("/rfid/checkin")
async def rfid_checkin(inp: RfidCheckinIn, user: dict = Depends(get_current_user)):
    log = {
        "log_id": new_id(),
        "student_id": inp.student_id,
        "location": inp.location,
        "checked_in_at": utcnow().isoformat(),
    }
    await db.rfid_logs.insert_one(log)
    return clean_doc(log)


@api.get("/rfid/logs/{student_id}")
async def rfid_logs(student_id: str, user: dict = Depends(get_current_user)):
    docs = await db.rfid_logs.find({"student_id": student_id}, {"_id": 0}).sort("checked_in_at", -1).to_list(50)
    return docs


# ---------- LMS ----------
@api.post("/lms/materials")
async def lms_create(inp: LmsIn, user: dict = Depends(require_roles("teacher", "admin"))):
    mid = new_id()
    
    # Naye numeric class configuration mapping sync ("cls_10a" to "10")
    clean_class_id = str(inp.class_id).replace("cls_", "")
    
    doc = {
        "material_id": mid,
        "title": inp.title,
        "subject": inp.subject,
        "class_id": clean_class_id,
        "kind": inp.kind, # E.g. "pdf", "video", "link"
        "url": inp.url,
        "content_base64": inp.content_base64,
        "description": inp.description,
        "posted_by": user["user_id"],
        "created_at": utcnow().isoformat(),
    }
    await db.lms.insert_one(doc)
    return clean_doc(doc)


@api.get("/lms/materials")
async def lms_list(class_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    
    if class_id:
        q["class_id"] = str(class_id).replace("cls_", "")
    elif user["role"] == "student" and user.get("class_id"):
        q["class_id"] = str(user["class_id"]).replace("cls_", "")
    elif user["role"] == "parent" and user.get("class_id"):
        q["class_id"] = str(user["class_id"]).replace("cls_", "")
    # Note: Teacher ya Admin login par agar class_id query nahi aati, 
    # toh saari classes ka material live load hoga.

    docs = await db.lms.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs



# ---------- GALLERY ----------

@api.post("/gallery/albums")
async def gallery_create(inp: GalleryAlbumIn, user: dict = Depends(require_roles("teacher", "admin"))):
    aid = new_id()
    
    # ⚡ Clean dynamic class string format mapping ("cls_10a" -> "10")
    clean_class_id = str(inp.class_id).replace("cls_", "") if inp.class_id else None
    
    doc = {
        "album_id": aid,
        "title": inp.title,
        "event_date": inp.event_date,
        "photos_base64": inp.photos_base64, # Real device base64 array payload data
        "class_id": clean_class_id,
        "created_at": utcnow().isoformat(),
    }
    await db.gallery.insert_one(doc)
    return clean_doc(doc)


@api.get("/gallery/albums")
async def gallery_list(user: dict = Depends(get_current_user)):
    # Sabhi verified logged-in users list dekh sakte hain
    docs = await db.gallery.find({}, {"_id": 0}).sort("event_date", -1).to_list(100)
    return docs


from bson import ObjectId
from fastapi.responses import JSONResponse

#  1. POORA ALBUM DELETE KARNA (Fixed Collection: db.gallery)
@api.delete("/gallery/albums/{album_id}")
async def delete_album(album_id: str, user: dict = Depends(get_current_user)):
    if not user:
        return JSONResponse(content={"detail": "Authentication token missing"}, status_code=401)
        
    if user.get("role") not in ["admin", "teacher"]:
        return JSONResponse(content={"detail": "Not authorized to delete albums"}, status_code=403)
        
    try:
        # Asli collection 'db.gallery' par hit karenge
        result = await db.gallery.delete_one({"album_id": album_id})
        
        # Fallback fields agar kisi alag structure mein id chali gayi ho
        if result.deleted_count == 0:
            result = await db.gallery.delete_one({"_id": album_id})
            
        if result.deleted_count == 0:
            try:
                result = await db.gallery.delete_one({"_id": ObjectId(album_id)})
            except Exception:
                pass
                
        if result.deleted_count == 0:
            return JSONResponse(content={"detail": "Album not found in database"}, status_code=404)
            
        logger.info(f"Successfully deleted album: {album_id}")
        return {"status": "success", "message": "Album cleared successfully from DB"}
        
    except Exception as e:
        logger.error(f"Critical error during gallery deletion: {str(e)}")
        return JSONResponse(content={"detail": f"Database processing error: {str(e)}"}, status_code=500)


#  2. ALBUM KE ANDAR SE SINGLE PHOTO DELETE KARNA (Fixed Collection: db.gallery)
@api.delete("/gallery/albums/{album_id}/photos/{photo_idx}")
async def delete_photo(album_id: str, photo_idx: int, user: dict = Depends(get_current_user)):
    if not user or user.get("role") not in ["admin", "teacher"]:
        return JSONResponse(content={"detail": "Not authorized to delete photos"}, status_code=403)
        
    try:
        # Step A: Array ke specific index ko null set karenge
        await db.gallery.update_one(
            {"album_id": album_id},
            {"$unset": {f"photos_base64.{photo_idx}": 1}}
        )
        # Step B: Null values ko array se completely pull (remove) kar denge
        result = await db.gallery.update_one(
            {"album_id": album_id},
            {"$pull": {"photos_base64": None}}
        )
        
        return {"status": "success", "message": "Photo deleted successfully from album"}
        
    except Exception as e:
        logger.error(f"Photo delete operation failed: {str(e)}")
        return JSONResponse(content={"detail": f"Database error: {str(e)}"}, status_code=500)


# ---------- 💬 CHAT (Parent <-> Teacher One-to-One) ----------
# (Isme user session tracking dynamic authentication required rahegi)
@api.post("/chat/send")
async def chat_send(inp: ChatSendIn, user: dict = Depends(get_current_user)):
    thread_id = "_".join(sorted([user["user_id"], inp.to_user_id]))
    msg = {
        "message_id": new_id(),
        "thread_id": thread_id,
        "from_user_id": user["user_id"],
        "from_user_name": user["name"],
        "to_user_id": inp.to_user_id,
        "body": inp.body,
        "created_at": utcnow().isoformat(),
    }
    await db.chat_messages.insert_one(msg)
    return clean_doc(msg)


@api.get("/chat/threads")
async def chat_threads(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"$or": [{"from_user_id": user["user_id"]}, {"to_user_id": user["user_id"]}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$thread_id",
            "last": {"$first": "$$ROOT"},
        }},
    ]
    threads = []
    async for grp in db.chat_messages.aggregate(pipeline):
        msg = grp["last"]
        msg.pop("_id", None)
        other_id = msg["to_user_id"] if msg["from_user_id"] == user["user_id"] else msg["from_user_id"]
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "password": 0})
        threads.append({"thread_id": grp["_id"], "last": msg, "other_user": other})
    return threads


@api.get("/chat/thread/{thread_id}")
async def chat_thread_messages(thread_id: str, user: dict = Depends(get_current_user)):
    docs = await db.chat_messages.find({"thread_id": thread_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return docs




# ---------- 🤖 GOOGLE-STYLE OPEN AI CONTEXT PROMPTS ----------
_SYSTEM_MSG_EN = (
    "You are a helpful, brilliant general-purpose AI assistant. "
    "Answer ANY question asked by the user including coding, math, general knowledge, essays, or stories."
)

_SYSTEM_MSG_HI = (
    "Aap ek smart aur helpful AI assistant ho. User jo bhi pooche—jaise kahani, coding, "
    "math, ya koi bhi topic—sabka jawab do. Apna jawab hamesha Hinglish (Roman Hindi) mein likho."
)


# ---------- 🤖 PUBLIC AI CHATBOT (Groq Core Integration) ----------
@api.post("/chatbot")
@api.post("/chatbot/chat")
async def chatbot_interface(inp: ChatbotIn):
    system_msg = _SYSTEM_MSG_HI if inp.language == "hi" else _SYSTEM_MSG_EN
    reply = ""

    GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
    client = Groq(api_key=GROQ_API_KEY)

    try:
        print("Connecting to Groq High-Speed AI cloud...")
        url = "https://api.groq.com/openai/v1/chat/completions"
        
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "llama-3.3-70b-versatile",  # Superfast & powerful model
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": inp.message}
            ],
            "temperature": 0.7
        }

        #  4 Spaces indented inside try block properly
        async with httpx.AsyncClient(timeout=30.0) as client_http:
            response = await client_http.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                res_data = response.json()
                if "choices" in res_data and len(res_data["choices"]) > 0:
                    reply = res_data["choices"][0]["message"]["content"].strip()
            else:
                print(f"Groq API Error Dump: {response.text}")

    except Exception as e:
        print("Chatbot External Engine Failure:", str(e))

    if not reply:
        reply = "Main abhi is query ka output fetch nahi kar paaya. Kripya ek baar aur koshish karein."

    # # Save chat history
    chat_doc = {
        "session_id": inp.session_id,
        "user_message": inp.message,
        "bot_reply": reply,
        "created_at": utcnow().isoformat()
    }

    try:
        await db.chatbot_history.insert_one(chat_doc)
    except Exception as db_e:
        print("Database insert failed:", str(db_e))

    return {"reply": reply}


# ---------- DASHBOARD ----------
@api.get("/dashboard/admin")
async def admin_dashboard(user: dict = Depends(require_roles("admin"))):
    total_students = await db.users.count_documents({"role": "student"})
    total_teachers = await db.users.count_documents({"role": "teacher"})
    total_parents = await db.users.count_documents({"role": "parent"})
    today = utcnow().strftime("%Y-%m-%d")
    today_att = await db.attendance.find({"date": today}, {"_id": 0}).to_list(500)
    present_today = sum(1 for r in today_att if r["status"] == "present")
    fees_paid = await db.fees.count_documents({"status": "paid"})
    fees_pending = await db.fees.count_documents({"status": "pending"})
    pending_leaves = await db.leaves.count_documents({"status": "pending"})
    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_parents": total_parents,
        "today_present": present_today,
        "today_marked": len(today_att),
        "fees_paid": fees_paid,
        "fees_pending": fees_pending,
        "pending_leaves": pending_leaves,
    }

# ---------- HEALTH ----------
@api.get("/")
async def root():
    return {"ok": True, "service": "Vidya Sahaayak School API"}


# ---------- SEED DATA ----------
async def seed_data():
    if await db.users.count_documents({}) > 0:
        logger.info("Seed data already present, skipping.")
        return
    logger.info("Seeding initial school data...")

    # Class 1 se 12 tak dynamic mapping system entries base schemas
    for i in range(1, 13):
        cls_id = str(i)
        await db.classes.insert_one({
            "class_id": cls_id, 
            "name": f"Class {i}", 
            "section": "A", 
            "grade": i
        })

    # Default Base Fees Structure dynamic seed (Class 1-12)
    # Taki register page dynamic rates ke sath link rahe
    for i in range(1, 13):
        await db.fees_structure.insert_one({
            "class_id": str(i),
            "amount": float(3000 + (i * 500)), # E.g., Class 1 = 3500, Class 10 = 8000
            "updated_at": utcnow().isoformat()
        })

    # Admin
    admin_id = new_id()
    admin = {
        "user_id": admin_id, "email": "admin@school.com", "password": hash_password("admin123"),
        "name": "Priya Sharma (Principal)", "role": "admin", "avatar_url": None,
        "created_at": utcnow().isoformat(),
    }
    await db.users.insert_one(admin)

    # Teachers (Allocated to Class "10")
    teacher1_id = new_id()
    teacher2_id = new_id()
    await db.users.insert_many([
        {"user_id": teacher1_id, "email": "teacher@school.com", "password": hash_password("teacher123"),
         "name": "Rajesh Kumar", "role": "teacher", "subject": "Mathematics", "class_id": "10",
         "avatar_url": None, "created_at": utcnow().isoformat()},
        {"user_id": teacher2_id, "email": "meena@school.com", "password": hash_password("teacher123"),
         "name": "Meena Iyer", "role": "teacher", "subject": "Science", "class_id": "10",
         "avatar_url": None, "created_at": utcnow().isoformat()},
    ])

    # Students (Linked to Class "10")
    student_ids = []
    students_seed = [
        ("student@school.com", "Aarav Verma", "student123", "10A-01", "9876543210"),
        ("riya@school.com", "Riya Singh", "student123", "10A-02", "9876500123"),
        ("kabir@school.com", "Kabir Mehta", "student123", "10A-03", "9812345678"),
    ]
    for email, name, pw, roll, phone in students_seed:
        sid = new_id()
        student_ids.append(sid)
        await db.users.insert_one({
            "user_id": sid, "email": email, "password": hash_password(pw),
            "name": name, "role": "student", "class_id": "10", "avatar_url": None,
            "roll_no": roll, "guardian_phone": phone,
            "created_at": utcnow().isoformat(),
        })

    # Parents (each parent has one child)
    parents_seed = [
        ("parent@school.com", "Sunita Verma", "parent123", student_ids[0]),
        ("neha@school.com", "Neha Singh", "parent123", student_ids[1]),
        ("amit@school.com", "Amit Mehta", "parent123", student_ids[2]),
    ]
    for email, name, pw, child_id in parents_seed:
        await db.users.insert_one({
            "user_id": new_id(), "email": email, "password": hash_password(pw),
            "name": name, "role": "parent", "child_ids": [child_id], "avatar_url": None,
            "created_at": utcnow().isoformat(),
        })

    # Attendance — last 20 days (Mapped to Class "10")
    for i in range(20):
        d = (utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        for idx, sid in enumerate(student_ids):
            status = "present"
            if i % 7 == idx:
                status = "absent"
            elif i % 11 == idx:
                status = "late"
            await db.attendance.insert_one({
                "student_id": sid, "class_id": "10", "date": d, "status": status,
                "marked_by": teacher1_id, "marked_at": utcnow().isoformat(),
            })

    # Homework (Mapped to Class "10")
    hw_samples = [
        ("Mathematics", "Chapter 5 - Quadratic Equations", "Solve exercise 5.2 questions 1 to 10. Show all steps."),
        ("Science", "Physics - Light Reflection", "Draw ray diagrams for concave and convex mirrors."),
        ("English", "Essay - My Favourite Season", "Write a 300-word essay in your notebook."),
        ("Hindi", "Kavita Yaad Karo", "Kavita 'Madhur madhur mere deepak jal' yaad karke sunaani hai."),
    ]
    for i, (subj, title, desc) in enumerate(hw_samples):
        due = (utcnow() + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        await db.homework.insert_one({
            "homework_id": new_id(), "class_id": "10", "subject": subj, "title": title,
            "description": desc, "due_date": due, "attachment_base64": None, "attachment_name": None,
            "posted_by": teacher1_id, "posted_by_name": "Rajesh Kumar",
            "created_at": (utcnow() - timedelta(hours=i * 3)).isoformat(),
        })

    # Notices
    notices = [
        ("Diwali Vacation Announcement", "School will remain closed from 10th Nov to 16th Nov for Diwali celebrations. Wishing everyone a bright and safe festival.", "holiday", "all"),
        ("Annual Sports Day", "Annual Sports Day on 25th November at the school ground. Parents are cordially invited.", "event", "all"),
        ("Fee Reminder", "Term 2 fees due by 30th of this month. Please pay via the app or at the office.", "urgent", "parent"),
        ("PTM Schedule", "Parent-Teacher Meeting scheduled for this Saturday, 10 AM to 1 PM.", "event", "parent"),
    ]
    for i, (t, b, cat, tr) in enumerate(notices):
        await db.notices.insert_one({
            "notice_id": new_id(), "title": t, "body": b, "category": cat, "target_role": tr,
            "posted_by": admin_id, "posted_by_name": "Principal",
            "created_at": (utcnow() - timedelta(hours=i * 5)).isoformat(),
        })

    # Fees
    for sid in student_ids:
        await db.fees.insert_many([
            {"fee_id": new_id(), "student_id": sid, "title": "Term 2 Tuition Fee",
             "amount": 12500.0, "due_date": (utcnow() + timedelta(days=15)).strftime("%Y-%m-%d"),
             "status": "pending", "created_at": utcnow().isoformat()},
            {"fee_id": new_id(), "student_id": sid, "title": "Bus Fee - Q2",
             "amount": 3200.0, "due_date": (utcnow() + timedelta(days=10)).strftime("%Y-%m-%d"),
             "status": "pending", "created_at": utcnow().isoformat()},
            {"fee_id": new_id(), "student_id": sid, "title": "Term 1 Tuition Fee",
             "amount": 12500.0, "due_date": (utcnow() - timedelta(days=60)).strftime("%Y-%m-%d"),
             "status": "paid", "paid_at": (utcnow() - timedelta(days=50)).isoformat(),
             "receipt_id": "RCPT-" + new_id()[:10].upper(), "created_at": utcnow().isoformat()},
        ])

    # Report Cards — Term 1
    for sid in student_ids:
        subjects = [
            {"name": "Mathematics", "marks": 85, "max_marks": 100, "grade": "A"},
            {"name": "Science", "marks": 78, "max_marks": 100, "grade": "B+"},
            {"name": "English", "marks": 88, "max_marks": 100, "grade": "A"},
            {"name": "Hindi", "marks": 92, "max_marks": 100, "grade": "A+"},
            {"name": "Social Studies", "marks": 80, "max_marks": 100, "grade": "A"},
        ]
        total = sum(s["marks"] for s in subjects)
        max_total = sum(s["max_marks"] for s in subjects)
        await db.report_cards.insert_one({
            "report_id": new_id(), "student_id": sid, "term": "Term 1 - 2026",
            "subjects": subjects, "total": total, "max_total": max_total,
            "percentage": round(total / max_total * 100, 1),
            "remarks": "Excellent progress. Keep up the good work!",
            "created_at": utcnow().isoformat(),
        })

    # Timetable (Mapped to Class "10")
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    subjects_seed = ["Mathematics", "Science", "English", "Hindi", "Social Studies", "Sports"]
    for day in days:
        periods = []
        for i in range(6):
            start_hour = 8 + i
            subj = subjects_seed[(days.index(day) + i) % len(subjects_seed)]
            periods.append({
                "time": f"{start_hour:02d}:00 - {start_hour:02d}:45",
                "subject": subj,
                "teacher": "Rajesh Kumar" if subj == "Mathematics" else "Meena Iyer" if subj == "Science" else "Class Teacher",
            })
        await db.timetable.insert_one({
            "class_id": "10", "day": day, "periods": periods,
            "updated_at": utcnow().isoformat(),
        })

    # Bus location
    await db.buses.insert_one({
        "bus_id": "BUS-01", "lat": 28.6139, "lng": 77.2090, "speed": 32.5,
        "next_stop": "Green Park Metro", "eta_minutes": 8, "route": "Route A",
        "updated_at": utcnow().isoformat(),
    })

    # RFID logs
    for sid in student_ids[:2]:
        await db.rfid_logs.insert_one({
            "log_id": new_id(), "student_id": sid, "location": "gate",
            "checked_in_at": utcnow().isoformat(),
        })

    # LMS materials (Mapped to Class "10")
    lms_items = [
        {"title": "Algebra Basics - Video Lecture", "subject": "Mathematics", "kind": "video", "url": "https://www.youtube.com/watch?v=NybHckSEQBI", "desc": "Introduction to algebraic equations."},
        {"title": "Photosynthesis Explained", "subject": "Science", "kind": "video", "url": "https://www.youtube.com/watch?v=D1Ymc311XS8", "desc": "How plants make food."},
        {"title": "Grammar Notes - Tenses", "subject": "English", "kind": "notes", "url": None, "desc": "Complete notes on present, past, and future tenses."},
        {"title": "Hindi Vyakaran - Sangya", "subject": "Hindi", "kind": "notes", "url": None, "desc": "Sangya ke prakar aur udaharan."},
    ]
    for i, item in enumerate(lms_items):
        await db.lms.insert_one({
            "material_id": new_id(), "title": item["title"], "subject": item["subject"], "class_id": "10",
            "kind": item["kind"], "url": item["url"], "content_base64": None, "description": item["desc"],
            "posted_by": teacher1_id, "created_at": utcnow().isoformat(),
        })

    # Gallery albums
    await db.gallery.insert_one({
        "album_id": new_id(), "title": "Independence Day Celebrations 2025",
        "event_date": "2025-08-15", "photos_base64": [], "class_id": None,
        "cover_url": "https://images.unsplash.com/photo-1523240795612-9a054b0db644",
        "created_at": utcnow().isoformat(),
    })
    await db.gallery.insert_one({
        "album_id": new_id(), "title": "Annual Day 2025",
        "event_date": "2025-12-10", "photos_base64": [], "class_id": None,
        "cover_url": "https://images.unsplash.com/photo-1509062522246-3755977927d7",
        "created_at": utcnow().isoformat(),
    })

    logger.info("Seed data created successfully.")


# ---------- LIFESPAN (STARTUP + SHUTDOWN) ----------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- STARTUP LOGIC (Server chalu hote hi ye chalega) ---
    try:
        # Database Indexes create karna
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.attendance.create_index([("student_id", 1), ("date", 1)], unique=True)
        await db.homework.create_index("class_id")
        await db.notices.create_index("created_at")
        await db.fees.create_index("student_id")
        await db.report_cards.create_index("student_id")
        await db.timetable.create_index([("class_id", 1), ("day", 1)], unique=True)
        await db.buses.create_index("bus_id", unique=True)
        await db.chat_messages.create_index("thread_id")
        
        # Initial Dummy Data insert karna
        await seed_data()
        
        # Migration: Pehle se moujood students ka roll_no aur phone number backfill karna
        roll_map = {
            "student@school.com": ("10A-01", "9876543210"),
            "riya@school.com": ("10A-02", "9876500123"),
            "kabir@school.com": ("10A-03", "9812345678"),
        }
        for email, (roll, phone) in roll_map.items():
            await db.users.update_one(
                {"email": email, "role": "student", "$or": [{"roll_no": {"$exists": False}}, {"roll_no": None}]},
                {"$set": {"roll_no": roll, "guardian_phone": phone}},
            )
    except Exception as e:
        logger.error(f"Startup error during initialization: {e}")

    yield  # <-- Iske upar ka code startup hai, iske niche ka code shutdown hai

    # --- SHUTDOWN LOGIC (Server band hote hi ye chalega) ---
    try:
        client.close()
        logger.info("Database connection closed successfully.")
    except Exception as e:
        logger.error(f"Shutdown error: {e}")


# --- MIDDLEWARE & ROUTER CONFIGURATION ---
# Note: Agar aapne top par app = FastAPI() pehle se likha hua hai, 


app.include_router(api);