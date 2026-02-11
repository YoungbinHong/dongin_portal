from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
import uvicorn
import os
import time
import datetime
import asyncio
import random
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email_validator import validate_email, EmailNotValidError
from logger import logger, get_user_logger, get_access_logger, get_event_logger

from database import engine, get_db, Base
from models import User, Post, Comment, Inventory
from schemas import (
    UserCreate, UserUpdate, UserResponse,
    Token, PasswordChange, EventLog,
    PostCreate, PostResponse, CommentCreate, CommentResponse,
    AiChatRequest,
    CheckEmailRequest, SendOtpRequest, VerifyOtpRequest, SignupRequest,
    InventoryCreate, InventoryUpdate, InventoryResponse,
)
import ai_engine
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_current_active_admin
)

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

ai_queue = asyncio.Queue()
ai_processing = False
ai_lock = asyncio.Lock()

otp_store = {}
verified_emails = {}
_last_online_count = None

async def monitor_online_users():
    """백그라운드에서 접속자 수 변경 감시"""
    global _last_online_count

    while True:
        try:
            await asyncio.sleep(10)

            db = next(get_db())
            try:
                threshold = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))) - datetime.timedelta(seconds=60)

                online_users = db.query(User).filter(
                    User.last_heartbeat.isnot(None),
                    User.last_heartbeat >= threshold,
                    User.is_active == True
                ).all()

                count = len(online_users)

                if _last_online_count is not None and _last_online_count != count:
                    logger.info(f"[접속자 변경] {_last_online_count}명 → {count}명")

                _last_online_count = count
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[접속자 감시 오류] {str(e)}")

def init_test_accounts(db: Session):
    if not db.query(User).filter(User.username == "admin").first():
        db.add(User(
            username="admin",
            hashed_password=get_password_hash("admin"),
            name="관리자",
            position="시스템관리자",
            role="admin",
            is_active=True
        ))
    if not db.query(User).filter(User.username == "user").first():
        db.add(User(
            username="user",
            hashed_password=get_password_hash("user"),
            name="테스트유저",
            position="테스트",
            role="user",
            is_active=True
        ))
    db.commit()

def init_seed_posts(db: Session):
    if db.query(Post).first():
        return
    seeds = [
        Post(category="notice", title="DONGIN COMMUNITY 오픈 안내", content="DONGIN COMMUNITY에 오신 것을 환영합니다.\n\n자유롭게 의견을 나누고 소통하는 공간입니다.\n서로 존중하며 건설적인 대화를 나누어주세요.", author="admin", views=245, likes=18),
        Post(category="question", title="PDF Editor 사용법 문의", content="PDF 파일을 병합하려고 하는데 순서를 바꿀 수 있나요?", author="user", views=89, likes=5),
        Post(category="suggestion", title="다크 모드 색상 개선 건의", content="다크 모드 사용 시 일부 텍스트가 잘 안 보여요.\n좀 더 명도를 높여주시면 좋을 것 같습니다.", author="user", views=156, likes=12),
        Post(category="general", title="AI Agent 정말 편리하네요", content="업무용으로 사용 중인데 정말 유용합니다.\n특히 문서 작성 기능이 마음에 들어요.", author="user", views=203, likes=24),
        Post(category="general", title="새로운 기능 추가 예정인가요?", content="앞으로 어떤 기능들이 추가될 예정인지 궁금합니다.", author="user", views=178, likes=8),
    ]
    for p in seeds:
        db.add(p)
    db.commit()
    seed_comments = [
        Comment(post_id=1, author="user", text="오픈 축하드립니다!"),
        Comment(post_id=1, author="user", text="기대됩니다"),
        Comment(post_id=2, author="user", text="드래그 앤 드롭으로 순서 변경 가능합니다"),
        Comment(post_id=4, author="user", text="저도 잘 쓰고 있습니다!"),
    ]
    for c in seed_comments:
        db.add(c)
    db.commit()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("="*50)
    logger.info("Dongin Portal 서버 시작 중...")
    logger.info("="*50)

    Base.metadata.create_all(bind=engine)
    logger.info("데이터베이스 테이블 생성 완료")

    from sqlalchemy import text, inspect as sa_inspect
    insp = sa_inspect(engine)
    cols = [c["name"] for c in insp.get_columns("users")]
    if "last_heartbeat" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_heartbeat TIMESTAMPTZ"))
        logger.info("데이터베이스 스키마 업데이트 완료 (last_heartbeat 컬럼 추가)")
    if "email" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE"))
        logger.info("데이터베이스 스키마 업데이트 완료 (email 컬럼 추가)")

    if "inventory" in insp.get_table_names():
        inv_cols = [c["name"] for c in insp.get_columns("inventory")]
        if "low_stock_threshold" not in inv_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE inventory ADD COLUMN low_stock_threshold INTEGER DEFAULT 10 NOT NULL"))
            logger.info("데이터베이스 스키마 업데이트 완료 (low_stock_threshold 컬럼 추가)")

    db = next(get_db())
    try:
        init_test_accounts(db)
        logger.info("테스트 계정 초기화 완료 (admin, user)")

        init_seed_posts(db)
        logger.info("초기 게시글 데이터 생성 완료")

        db.query(User).update({User.last_heartbeat: None})
        db.commit()
        logger.info("모든 사용자 heartbeat 초기화 완료")

        logger.info("="*50)
        logger.info("Dongin Portal 서버 시작 완료! 🚀")
        logger.info("로그 파일 위치: server/logs/")
        logger.info("API 문서: http://localhost:8000/docs")
        logger.info("="*50)
    finally:
        db.close()

    monitor_task = asyncio.create_task(monitor_online_users())
    logger.info("접속자 감시 백그라운드 태스크 시작")

    yield

    monitor_task.cancel()
    logger.info("="*50)
    logger.info("Dongin Portal 서버 종료")
    logger.info("="*50)

app = FastAPI(
    title="Dongin Portal API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    max_age=600,
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

@app.middleware("http")
async def log_requests(request: Request, call_next):
    # heartbeat, health 체크는 로깅 제외
    skip_paths = {"/api/heartbeat", "/health", "/api/ai/chat"}
    should_log = request.url.path not in skip_paths

    start_time = time.time()
    access_logger = get_access_logger()

    if should_log:
        client_host = request.client.host if request.client else "unknown"
        access_logger.info(f"[요청] {request.method} {request.url.path} | 클라이언트: {client_host}")

    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000

        if should_log:
            access_logger.info(f"[응답] {request.method} {request.url.path} | 상태: {response.status_code} | 처리시간: {process_time:.2f}ms")

        return response
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.error(f"[오류] {request.method} {request.url.path} | 처리시간: {process_time:.2f}ms | 오류: {str(e)}", exc_info=True)
        raise

UPDATES_DIR = os.path.join(os.path.dirname(__file__), "updates")
os.makedirs(UPDATES_DIR, exist_ok=True)

def _parse_latest_yml():
    p = os.path.join(UPDATES_DIR, "latest.yml")
    if not os.path.isfile(p):
        return None, None
    version, path_val = None, None
    with open(p, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("version:"):
                version = line.split(":", 1)[1].strip().strip("'\"").strip()
            elif line.startswith("path:"):
                path_val = line.split(":", 1)[1].strip().strip("'\"").strip()
    return version, path_val

def _version_geq(client_ver, server_ver):
    def parse(v):
        parts = (v or "0").replace("-", ".").split(".")
        return [int(x) if x.isdigit() else 0 for x in parts[:3]]
    c, s = parse(client_ver), parse(server_ver)
    for i in range(max(len(c), len(s))):
        a, b = c[i] if i < len(c) else 0, s[i] if i < len(s) else 0
        if a > b:
            return True
        if a < b:
            return False
    return True

@app.get("/api/update/check")
async def update_check(version: str = "0.0.0"):
    server_version, path_val = _parse_latest_yml()
    if not server_version or not path_val:
        logger.warning(f"[업데이트 확인] 클라이언트 버전: {version} | 서버에 latest.yml 없음")
        return {"updateAvailable": False, "version": version}
    update_available = not _version_geq(version, server_version)
    out = {"updateAvailable": update_available, "version": server_version}
    if update_available:
        out["downloadUrl"] = "/updates/" + path_val
        logger.info(f"[업데이트 확인] 클라이언트 버전: {version} | 서버 버전: {server_version} | 업데이트 필요")
    else:
        logger.info(f"[업데이트 확인] 클라이언트 버전: {version} | 서버 버전: {server_version} | 최신 버전")
    return out

@app.get("/updates/latest.yml")
async def serve_latest_yml():
    path = os.path.join(UPDATES_DIR, "latest.yml")
    if not os.path.isfile(path):
        logger.warning("updates/latest.yml not found at %s", path)
        raise HTTPException(status_code=404, detail="latest.yml not found")
    return FileResponse(path, media_type="text/yaml")

@app.get("/download")
async def download_page():
    from fastapi.responses import HTMLResponse
    version, path_val = _parse_latest_yml()
    if not version or not path_val:
        raise HTTPException(status_code=404, detail="설치 파일이 없습니다")

    file_path = os.path.join(UPDATES_DIR, path_val)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="설치 파일이 없습니다")

    file_size = os.path.getsize(file_path)
    file_size_mb = file_size / (1024 * 1024)

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DONGIN PORTAL 다운로드</title>
        <style>
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }}
            .container {{
                background: white;
                border-radius: 20px;
                padding: 60px 40px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                text-align: center;
                max-width: 500px;
                width: 100%;
            }}
            h1 {{
                color: #333;
                font-size: 32px;
                margin-bottom: 10px;
            }}
            .version {{
                color: #666;
                font-size: 18px;
                margin-bottom: 30px;
            }}
            .info {{
                color: #888;
                font-size: 14px;
                margin-bottom: 40px;
            }}
            .download-btn {{
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 18px 50px;
                font-size: 18px;
                font-weight: 600;
                border-radius: 50px;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
                text-decoration: none;
                display: inline-block;
            }}
            .download-btn:hover {{
                transform: translateY(-2px);
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
            }}
            .download-btn:active {{
                transform: translateY(0);
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>DONGIN PORTAL</h1>
            <div class="version">버전 {version}</div>
            <div class="info">파일 크기: {file_size_mb:.1f} MB</div>
            <a href="/download/latest" class="download-btn">다운로드</a>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)

@app.get("/download/latest")
async def download_latest():
    version, path_val = _parse_latest_yml()
    if not version or not path_val:
        raise HTTPException(status_code=404, detail="설치 파일이 없습니다")

    file_path = os.path.join(UPDATES_DIR, path_val)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="설치 파일이 없습니다")

    filename = os.path.basename(path_val)
    logger.info(f"[다운로드] 파일: {filename} | 버전: {version}")

    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=filename,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

app.mount("/updates", StaticFiles(directory=UPDATES_DIR), name="updates")

@app.get("/")
async def root():
    return {"message": "Dongin Portal API"}

@app.get("/health")
async def health(db: Session = Depends(get_db)):
    return {"status": "ok"}

async def send_otp_email(email: str, otp: str):
    dev_mode = os.getenv("DEV_MODE", "true").lower() == "true"

    if dev_mode:
        logger.info(f"[개발 모드] OTP 발송 → 이메일: {email} | 인증번호: {otp}")
        print(f"\n{'='*50}")
        print(f"[OTP 인증번호]")
        print(f"이메일: {email}")
        print(f"인증번호: {otp}")
        print(f"{'='*50}\n")
        return

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user or not smtp_password:
        raise HTTPException(status_code=500, detail="SMTP 설정이 필요합니다")

    msg = MIMEMultipart()
    msg["From"] = smtp_from
    msg["To"] = email
    msg["Subject"] = "[DONGIN PORTAL] 이메일 인증번호"

    body = f"""안녕하세요.
회원가입을 위한 인증번호는 다음과 같습니다.

인증번호: {otp}

인증번호는 5분간 유효합니다."""

    msg.attach(MIMEText(body, "plain"))

    if smtp_port == 465:
        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            use_tls=True,
        )
    else:
        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            start_tls=True,
        )

async def send_approval_email(email: str, name: str):
    dev_mode = os.getenv("DEV_MODE", "true").lower() == "true"

    if dev_mode:
        logger.info(f"[개발 모드] 승인 완료 이메일 발송 → 이메일: {email}")
        print(f"\n{'='*50}")
        print(f"[가입 승인 완료]")
        print(f"이메일: {email}")
        print(f"이름: {name}")
        print(f"{'='*50}\n")
        return

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM", smtp_user)

    if not smtp_host or not smtp_user or not smtp_password:
        raise HTTPException(status_code=500, detail="SMTP 설정이 필요합니다")

    msg = MIMEMultipart()
    msg["From"] = smtp_from
    msg["To"] = email
    msg["Subject"] = "[DONGIN PORTAL] 회원가입 승인 완료"

    body = f"""안녕하세요, {name}님.

DONGIN PORTAL 회원가입이 승인되었습니다.
이제 모든 서비스를 이용하실 수 있습니다.

감사합니다."""

    msg.attach(MIMEText(body, "plain"))

    if smtp_port == 465:
        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            use_tls=True,
        )
    else:
        await aiosmtplib.send(
            msg,
            hostname=smtp_host,
            port=smtp_port,
            username=smtp_user,
            password=smtp_password,
            start_tls=True,
        )

@app.post("/api/auth/check-email")
async def check_email(request: CheckEmailRequest, db: Session = Depends(get_db)):
    try:
        validate_email(request.email, check_deliverability=True)
    except EmailNotValidError as e:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 이메일: {str(e)}")

    existing_user = db.query(User).filter(User.email == request.email).first()
    return {"exists": existing_user is not None}

@app.post("/api/auth/send-otp")
async def send_otp(request: SendOtpRequest):
    try:
        validate_email(request.email, check_deliverability=True)
    except EmailNotValidError as e:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 이메일: {str(e)}")

    otp = str(random.randint(100000, 999999))

    try:
        await send_otp_email(request.email, otp)
    except Exception as e:
        logger.error(f"[OTP 발송 실패] 이메일: {request.email} | 오류: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"이메일 발송 실패: {str(e)}")

    otp_store[request.email] = {
        "otp": otp,
        "expires_at": time.time() + 300
    }

    logger.info(f"[OTP 발송 완료] 이메일: {request.email}")
    return {"success": True}

@app.post("/api/auth/verify-otp")
async def verify_otp(request: VerifyOtpRequest):
    stored = otp_store.get(request.email)

    if not stored:
        raise HTTPException(status_code=400, detail="OTP를 먼저 요청해주세요")

    if time.time() > stored["expires_at"]:
        del otp_store[request.email]
        raise HTTPException(status_code=400, detail="OTP가 만료되었습니다")

    if stored["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="OTP가 일치하지 않습니다")

    verified_emails[request.email] = time.time() + 300
    del otp_store[request.email]

    logger.info(f"[OTP 인증 완료] 이메일: {request.email}")
    return {"verified": True}

@app.post("/api/auth/signup")
async def signup(request: SignupRequest, db: Session = Depends(get_db)):
    verified_time = verified_emails.get(request.email)

    if not verified_time or time.time() > verified_time:
        raise HTTPException(status_code=400, detail="이메일 인증이 필요합니다")

    try:
        validate_email(request.email, check_deliverability=True)
    except EmailNotValidError as e:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 이메일: {str(e)}")

    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다")

    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="비밀번호는 8자 이상이어야 합니다")

    username = request.email

    user = User(
        username=username,
        email=request.email,
        hashed_password=get_password_hash(request.password),
        name=request.name,
        position="일반",
        role="user",
        is_active=False,
        approval_status="pending"
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    del verified_emails[request.email]

    logger.info(f"[회원가입 요청] 이메일: {request.email} | 사용자명: {username} | 상태: 승인 대기")
    return {"success": True, "message": "회원가입 요청이 완료되었습니다. 관리자 승인 후 이용 가능합니다."}


@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"[로그인 실패] 사용자명: {form_data.username} | 이유: 잘못된 인증 정보")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 또는 비밀번호 오류")
    if not user.is_active:
        if user.approval_status == "pending":
            logger.warning(f"[로그인 실패] 사용자명: {user.username} | 이유: 승인 대기 중")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 승인 대기 중입니다")
        logger.warning(f"[로그인 실패] 사용자명: {user.username} | 이유: 비활성화된 계정")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성화된 계정")
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    logger.info(f"[로그인 성공] 사용자: {user.username} | 역할: {user.role}")
    user_logger = get_user_logger(user.username)
    user_logger.info(f"[로그인 성공] 역할: {user.role}")
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.put("/api/users/me/password")
async def change_my_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not verify_password(password_data.current_password, current_user.hashed_password):
        logger.warning(f"[비밀번호 변경 실패] 사용자: {current_user.username} | 이유: 현재 비밀번호 불일치")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="현재 비밀번호 오류")
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    logger.info(f"[비밀번호 변경 완료] 사용자: {current_user.username}")
    user_logger = get_user_logger(current_user.username)
    user_logger.info("[비밀번호 변경 완료]")
    return {"message": "비밀번호 변경 완료"}

@app.get("/api/users", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).offset(skip).limit(limit).all()
    logger.info(f"[사용자 목록 조회] 관리자: {current_user.username} | 조회된 사용자 수: {len(users)}")
    return users

@app.get("/api/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning(f"[사용자 조회 실패] 관리자: {current_user.username} | 이유: 사용자 없음 (ID: {user_id})")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자 없음")
    logger.info(f"[사용자 조회] 관리자: {current_user.username} | 조회된 사용자: {user.username}")
    return user

@app.post("/api/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    if db.query(User).filter(User.username == user_data.username).first():
        logger.warning(f"[사용자 생성 실패] 관리자: {current_user.username} | 이유: 중복된 사용자명 ({user_data.username})")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 존재하는 사용자명")
    user = User(
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        name=user_data.name,
        position=user_data.position,
        role=user_data.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info(f"[사용자 생성 완료] 관리자: {current_user.username} | 신규 사용자: {user.username} | 역할: {user.role}")
    admin_logger = get_user_logger(current_user.username)
    admin_logger.info(f"[사용자 생성] 신규 사용자: {user.username} | 역할: {user.role}")
    return user

@app.put("/api/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning(f"[사용자 수정 실패] 관리자: {current_user.username} | 이유: 사용자 없음 (ID: {user_id})")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자 없음")
    update_data = user_data.model_dump(exclude_unset=True)
    updated_fields = list(update_data.keys())
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    logger.info(f"[사용자 정보 수정 완료] 관리자: {current_user.username} | 대상: {user.username} | 수정 항목: {', '.join(updated_fields)}")
    admin_logger = get_user_logger(current_user.username)
    admin_logger.info(f"[사용자 정보 수정] 대상: {user.username} | 수정 항목: {', '.join(updated_fields)}")
    return user

@app.put("/api/users/{user_id}/password")
async def reset_user_password(
    user_id: int,
    new_password: str,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning(f"[비밀번호 초기화 실패] 관리자: {current_user.username} | 이유: 사용자 없음 (ID: {user_id})")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자 없음")
    user.hashed_password = get_password_hash(new_password)
    db.commit()
    logger.info(f"[비밀번호 초기화 완료] 관리자: {current_user.username} | 대상 사용자: {user.username}")
    admin_logger = get_user_logger(current_user.username)
    admin_logger.info(f"[비밀번호 초기화] 대상 사용자: {user.username}")
    return {"message": "비밀번호 초기화 완료"}

@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        logger.warning(f"[사용자 삭제 실패] 관리자: {current_user.username} | 이유: 사용자 없음 (ID: {user_id})")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자 없음")
    if user.id == current_user.id:
        logger.warning(f"[사용자 삭제 실패] 관리자: {current_user.username} | 이유: 자기 자신 삭제 시도")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자기 자신 삭제 불가")
    username = user.username
    db.delete(user)
    db.commit()
    logger.info(f"[사용자 삭제 완료] 관리자: {current_user.username} | 삭제된 사용자: {username}")
    admin_logger = get_user_logger(current_user.username)
    admin_logger.info(f"[사용자 삭제] 삭제된 사용자: {username}")
    return {"message": "삭제 완료"}

@app.post("/api/heartbeat")
async def heartbeat(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.last_heartbeat = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    db.commit()
    # heartbeat는 너무 빈번하므로 로그 생략
    return {"status": "ok"}

@app.post("/api/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    logger.info(f"[로그아웃] 사용자: {current_user.username}")
    user_logger = get_user_logger(current_user.username)
    user_logger.info("[로그아웃]")
    return {"message": "로그아웃"}

@app.post("/api/event")
async def log_event(
    event: EventLog,
    current_user: User = Depends(get_current_user)
):
    event_logger = get_event_logger()
    event_logger.info(f"[이벤트] 사용자: {current_user.username} | 동작: {event.action}")
    user_logger = get_user_logger(current_user.username)
    user_logger.info(f"[이벤트] 동작: {event.action}")
    return {"message": "ok"}

def _post_to_dict(post: Post) -> dict:
    return {
        "id": post.id,
        "category": post.category,
        "title": post.title,
        "content": post.content,
        "author": post.author,
        "date": post.created_at.strftime("%Y-%m-%d") if post.created_at else "",
        "views": post.views,
        "likes": post.likes,
        "comments": [
            {
                "id": c.id,
                "post_id": c.post_id,
                "author": c.author,
                "text": c.text,
                "date": c.created_at.strftime("%Y-%m-%d") if c.created_at else ""
            }
            for c in post.comments
        ]
    }

@app.get("/api/posts")
async def get_posts(db: Session = Depends(get_db)):
    posts = db.query(Post).order_by(Post.created_at.desc()).all()
    logger.info(f"[게시글 목록 조회] 전체 게시글 수: {len(posts)}")
    return [_post_to_dict(p) for p in posts]

@app.get("/api/posts/{post_id}")
async def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        logger.warning(f"[게시글 조회 실패] 이유: 게시글 없음 (ID: {post_id})")
        raise HTTPException(status_code=404, detail="게시글 없음")
    post.views += 1
    db.commit()
    db.refresh(post)
    logger.info(f"[게시글 조회] ID: {post_id} | 제목: {post.title} | 조회수: {post.views}")
    return _post_to_dict(post)

@app.post("/api/posts", status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = Post(
        title=post_data.title,
        category=post_data.category,
        content=post_data.content,
        author=current_user.username
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    logger.info(f"[게시글 작성 완료] 작성자: {current_user.username} | 카테고리: {post.category} | 제목: {post.title}")
    user_logger = get_user_logger(current_user.username)
    user_logger.info(f"[게시글 작성] 카테고리: {post.category} | 제목: {post.title}")
    return _post_to_dict(post)

@app.delete("/api/posts/{post_id}")
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        logger.warning(f"[게시글 삭제 실패] 사용자: {current_user.username} | 이유: 게시글 없음 (ID: {post_id})")
        raise HTTPException(status_code=404, detail="게시글 없음")
    if post.author != current_user.username and current_user.role != "admin":
        logger.warning(f"[게시글 삭제 실패] 사용자: {current_user.username} | 이유: 권한 없음 (게시글 ID: {post_id})")
        raise HTTPException(status_code=403, detail="삭제 권한 없음")
    post_title = post.title
    db.delete(post)
    db.commit()
    logger.info(f"[게시글 삭제 완료] 사용자: {current_user.username} | 게시글: {post_title}")
    user_logger = get_user_logger(current_user.username)
    user_logger.info(f"[게시글 삭제] 제목: {post_title}")
    return {"message": "삭제 완료"}

@app.post("/api/posts/{post_id}/like")
async def toggle_like(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        logger.warning(f"[좋아요 실패] 사용자: {current_user.username} | 이유: 게시글 없음 (ID: {post_id})")
        raise HTTPException(status_code=404, detail="게시글 없음")
    post.likes += 1
    db.commit()
    logger.info(f"[좋아요] 사용자: {current_user.username} | 게시글: {post.title} | 총 좋아요: {post.likes}")
    user_logger = get_user_logger(current_user.username)
    user_logger.info(f"[좋아요] 게시글: {post.title}")
    return {"likes": post.likes}

@app.post("/api/posts/{post_id}/comments", status_code=status.HTTP_201_CREATED)
async def create_comment(
    post_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        logger.warning(f"[댓글 작성 실패] 사용자: {current_user.username} | 이유: 게시글 없음 (ID: {post_id})")
        raise HTTPException(status_code=404, detail="게시글 없음")
    comment = Comment(
        post_id=post_id,
        author=current_user.username,
        text=comment_data.text
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    logger.info(f"[댓글 작성 완료] 작성자: {current_user.username} | 게시글: {post.title} | 댓글 내용: {comment_data.text[:50]}{'...' if len(comment_data.text) > 50 else ''}")
    user_logger = get_user_logger(current_user.username)
    user_logger.info(f"[댓글 작성] 게시글: {post.title}")
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "author": comment.author,
        "text": comment.text,
        "date": comment.created_at.strftime("%Y-%m-%d") if comment.created_at else ""
    }

@app.post("/api/ai/chat")
async def ai_chat(req: AiChatRequest, current_user: User = Depends(get_current_user)):
    import json as _json
    global ai_processing

    logger.info(f"[AI 채팅] 사용자: {current_user.username} | 메시지: {req.message[:50]}{'...' if len(req.message) > 50 else ''}")
    user_logger = get_user_logger(current_user.username)
    user_logger.info(f"[AI 채팅] 메시지: {req.message[:50]}{'...' if len(req.message) > 50 else ''}")

    my_event = asyncio.Event()
    await ai_queue.put(my_event)

    async def event_stream():
        global ai_processing
        try:
            while True:
                queue_list = list(ai_queue._queue)
                position = queue_list.index(my_event) if my_event in queue_list else -1

                if position == 0:
                    async with ai_lock:
                        if not ai_processing:
                            ai_processing = True
                            await ai_queue.get()
                            break
                    yield f"data: {_json.dumps({'type': 'queue', 'position': 1}, ensure_ascii=False)}\n\n"
                elif position > 0:
                    yield f"data: {_json.dumps({'type': 'queue', 'position': position}, ensure_ascii=False)}\n\n"

                await asyncio.sleep(0.5)

            yield f"data: {_json.dumps({'type': 'processing'}, ensure_ascii=False)}\n\n"

            history = [m.model_dump() for m in req.history] if req.history else None
            async for chunk in ai_engine.chat_stream(req.message, history):
                yield f"data: {_json.dumps(chunk, ensure_ascii=False)}\n\n"
        except Exception as e:
            logger.error(f"[AI 채팅 오류] 사용자: {current_user.username} | 오류: {str(e)}")
            yield f"data: {_json.dumps({'content': f'오류가 발생했습니다: {str(e)}', 'done': True}, ensure_ascii=False)}\n\n"
        finally:
            ai_processing = False

    return StreamingResponse(event_stream(), media_type="text/event-stream")

@app.get("/api/ai/status")
async def ai_status(current_user: User = Depends(get_current_user)):
    result = await ai_engine.check_status()
    logger.info(f"[AI 상태] 사용자: {current_user.username} | ollama: {result['ollama']} | 모델: {result['model_loaded']}")
    return result

@app.get("/api/admin/online-users")
async def get_online_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    threshold = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))) - datetime.timedelta(seconds=60)

    online_users = db.query(User).filter(
        User.last_heartbeat.isnot(None),
        User.last_heartbeat >= threshold,
        User.is_active == True
    ).all()

    return {
        "count": len(online_users),
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "name": u.name,
                "role": u.role,
                "last_heartbeat": u.last_heartbeat.isoformat() if u.last_heartbeat else None
            }
            for u in online_users
        ]
    }

@app.get("/api/admin/users/pending", response_model=List[UserResponse])
async def get_pending_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_active_admin)):
    users = db.query(User).filter(User.approval_status == "pending").all()
    logger.info(f"[관리자] 승인 대기 목록 조회: {current_user.username} | 대기 중: {len(users)}명")
    return users

@app.post("/api/admin/users/{user_id}/approve")
async def approve_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    if user.approval_status != "pending":
        raise HTTPException(status_code=400, detail="승인 대기 상태가 아닙니다")

    user.is_active = True
    user.approval_status = "approved"
    db.commit()

    try:
        await send_approval_email(user.email, user.name)
    except Exception as e:
        logger.error(f"[승인 이메일 발송 실패] 사용자: {user.username} | 오류: {str(e)}")

    logger.info(f"[관리자] 회원가입 승인: {current_user.username} → {user.username}")
    return {"success": True}

@app.post("/api/admin/users/{user_id}/reject")
async def reject_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_active_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    if user.approval_status != "pending":
        raise HTTPException(status_code=400, detail="승인 대기 상태가 아닙니다")

    db.delete(user)
    db.commit()

    logger.info(f"[관리자] 회원가입 거절: {current_user.username} → {user.username}")
    return {"success": True}

@app.get("/api/admin/online-users")
async def get_online_users(
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    kst = datetime.timezone(datetime.timedelta(hours=9))
    cutoff_time = datetime.datetime.now(kst) - datetime.timedelta(minutes=5)

    online_users = db.query(User).filter(
        User.last_heartbeat != None,
        User.last_heartbeat >= cutoff_time
    ).all()

    logger.info(f"[관리자] 접속자 목록 조회: {current_user.username} | 접속자 수: {len(online_users)}")

    return {
        "count": len(online_users),
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "name": u.name,
                "role": u.role,
                "last_heartbeat": u.last_heartbeat
            }
            for u in online_users
        ]
    }

@app.get("/api/inventory", response_model=List[InventoryResponse])
async def get_inventory(db: Session = Depends(get_db)):
    items = db.query(Inventory).order_by(Inventory.created_at.desc()).all()
    logger.info(f"[재고 목록 조회] 전체 재고 수: {len(items)}")
    return items

@app.get("/api/inventory/{item_id}", response_model=InventoryResponse)
async def get_inventory_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not item:
        logger.warning(f"[재고 조회 실패] 이유: 재고 없음 (ID: {item_id})")
        raise HTTPException(status_code=404, detail="재고 없음")
    logger.info(f"[재고 조회] ID: {item_id} | 품목: {item.name}")
    return item

@app.post("/api/inventory", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory(
    item_data: InventoryCreate,
    db: Session = Depends(get_db)
):
    item = Inventory(
        name=item_data.name,
        category=item_data.category,
        quantity=item_data.quantity,
        low_stock_threshold=item_data.low_stock_threshold,
        location=item_data.location
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    logger.info(f"[재고 추가 완료] 품목: {item.name} | 수량: {item.quantity} | 기준: {item.low_stock_threshold}")
    return item

@app.put("/api/inventory/{item_id}", response_model=InventoryResponse)
async def update_inventory(
    item_id: int,
    item_data: InventoryUpdate,
    db: Session = Depends(get_db)
):
    item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not item:
        logger.warning(f"[재고 수정 실패] 이유: 재고 없음 (ID: {item_id})")
        raise HTTPException(status_code=404, detail="재고 없음")
    update_data = item_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    logger.info(f"[재고 수정 완료] 품목: {item.name} | 수량: {item.quantity} | 기준: {item.low_stock_threshold}")
    return item

@app.delete("/api/inventory/{item_id}")
async def delete_inventory(
    item_id: int,
    db: Session = Depends(get_db)
):
    item = db.query(Inventory).filter(Inventory.id == item_id).first()
    if not item:
        logger.warning(f"[재고 삭제 실패] 이유: 재고 없음 (ID: {item_id})")
        raise HTTPException(status_code=404, detail="재고 없음")
    item_name = item.name
    db.delete(item)
    db.commit()
    logger.info(f"[재고 삭제 완료] 품목: {item_name}")
    return {"message": "삭제 완료"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        workers=1,
        limit_concurrency=400,
        log_level="info"
    )
