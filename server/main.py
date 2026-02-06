from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List
import uvicorn
import os
import sys
import logging
import datetime

class _SeoulFormatter(logging.Formatter):
    _tz = datetime.timezone(datetime.timedelta(hours=9))
    def formatTime(self, record, datefmt=None):
        ct = datetime.datetime.fromtimestamp(record.created, tz=self._tz)
        return ct.strftime(datefmt or "%Y-%m-%d %H:%M:%S")

_handler = logging.StreamHandler(sys.stdout)
_handler.setFormatter(_SeoulFormatter("%(asctime)s | %(message)s"))

logger = logging.getLogger("portal")
logger.setLevel(logging.INFO)
logger.addHandler(_handler)
logger.propagate = False

for _name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
    logging.getLogger(_name).setLevel(logging.WARNING)

from database import engine, get_db, Base
from models import User
from schemas import (
    UserCreate, UserUpdate, UserResponse,
    Token, PasswordChange, EventLog
)
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_user, get_current_active_admin
)

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        init_test_accounts(db)
    finally:
        db.close()
    yield

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
        return {"updateAvailable": False, "version": version}
    update_available = not _version_geq(version, server_version)
    out = {"updateAvailable": update_available, "version": server_version}
    if update_available:
        out["downloadUrl"] = "/updates/" + path_val
    return out

@app.get("/updates/latest.yml")
async def serve_latest_yml():
    path = os.path.join(UPDATES_DIR, "latest.yml")
    if not os.path.isfile(path):
        logger.warning("updates/latest.yml not found at %s", path)
        raise HTTPException(status_code=404, detail="latest.yml not found")
    return FileResponse(path, media_type="text/yaml")

app.mount("/updates", StaticFiles(directory=UPDATES_DIR), name="updates")

@app.get("/")
async def root():
    return {"message": "Dongin Portal API"}

@app.get("/health")
async def health(db: Session = Depends(get_db)):
    return {"status": "ok"}

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.info(f"{form_data.username} | 로그인 실패")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="아이디 또는 비밀번호 오류")
    if not user.is_active:
        logger.info(f"{user.username} | 로그인 실패 (비활성화)")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성화된 계정")
    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    logger.info(f"{user.username} | 로그인")
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
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="현재 비밀번호 오류")
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    logger.info(f"{current_user.username} | 비밀번호 변경")
    return {"message": "비밀번호 변경 완료"}

@app.get("/api/users", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    return db.query(User).offset(skip).limit(limit).all()

@app.get("/api/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자 없음")
    return user

@app.post("/api/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    if db.query(User).filter(User.username == user_data.username).first():
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
    logger.info(f"{current_user.username} | 사용자 생성: {user.username}")
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자 없음")
    update_data = user_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    logger.info(f"{current_user.username} | 사용자 수정: {user.username}")
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자 없음")
    user.hashed_password = get_password_hash(new_password)
    db.commit()
    logger.info(f"{current_user.username} | 비밀번호 초기화: {user.username}")
    return {"message": "비밀번호 초기화 완료"}

@app.delete("/api/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_active_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="사용자 없음")
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="자기 자신 삭제 불가")
    username = user.username
    db.delete(user)
    db.commit()
    logger.info(f"{current_user.username} | 사용자 삭제: {username}")
    return {"message": "삭제 완료"}

@app.post("/api/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    logger.info(f"{current_user.username} | 로그아웃")
    return {"message": "로그아웃"}

@app.post("/api/event")
async def log_event(
    event: EventLog,
    current_user: User = Depends(get_current_user)
):
    logger.info(f"{current_user.username} | {event.action}")
    return {"message": "ok"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        workers=4,
        limit_concurrency=400,
    )
