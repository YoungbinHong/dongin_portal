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
from models import User, Post, Comment
from schemas import (
    UserCreate, UserUpdate, UserResponse,
    Token, PasswordChange, EventLog,
    PostCreate, PostResponse, CommentCreate, CommentResponse
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
    Base.metadata.create_all(bind=engine)
    from sqlalchemy import text, inspect as sa_inspect
    insp = sa_inspect(engine)
    cols = [c["name"] for c in insp.get_columns("users")]
    if "last_heartbeat" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_heartbeat TIMESTAMPTZ"))
    db = next(get_db())
    try:
        init_test_accounts(db)
        init_seed_posts(db)
        db.query(User).update({User.last_heartbeat: None})
        db.commit()
        logger.info("서버 시작 | 모든 heartbeat 초기화")
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

@app.post("/api/heartbeat")
async def heartbeat(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    current_user.last_heartbeat = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
    db.commit()
    return {"status": "ok"}

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
    return [_post_to_dict(p) for p in posts]

@app.get("/api/posts/{post_id}")
async def get_post(post_id: int, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글 없음")
    post.views += 1
    db.commit()
    db.refresh(post)
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
    logger.info(f"{current_user.username} | 게시글 작성: {post.title}")
    return _post_to_dict(post)

@app.delete("/api/posts/{post_id}")
async def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글 없음")
    if post.author != current_user.username and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="삭제 권한 없음")
    db.delete(post)
    db.commit()
    logger.info(f"{current_user.username} | 게시글 삭제: {post.title}")
    return {"message": "삭제 완료"}

@app.post("/api/posts/{post_id}/like")
async def toggle_like(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="게시글 없음")
    post.likes += 1
    db.commit()
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
        raise HTTPException(status_code=404, detail="게시글 없음")
    comment = Comment(
        post_id=post_id,
        author=current_user.username,
        text=comment_data.text
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    logger.info(f"{current_user.username} | 댓글 작성: {post.title}")
    return {
        "id": comment.id,
        "post_id": comment.post_id,
        "author": comment.author,
        "text": comment.text,
        "date": comment.created_at.strftime("%Y-%m-%d") if comment.created_at else ""
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        workers=4,
        limit_concurrency=400,
    )
