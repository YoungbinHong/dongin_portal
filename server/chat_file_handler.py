import os
import uuid
from pathlib import Path
from PIL import Image, ImageOps
from fastapi import UploadFile
import aiofiles
from logger import logger

UPLOAD_DIR = Path("server/uploads/chat")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

CHUNK_SIZE = 500 * 1024

async def save_chat_file(file: UploadFile, room_id: str, file_id: str) -> str:
    """파일 청크 업로드 저장"""
    room_dir = UPLOAD_DIR / room_id
    room_dir.mkdir(exist_ok=True)

    file_ext = Path(file.filename).suffix
    file_path = room_dir / f"{file_id}{file_ext}"

    async with aiofiles.open(file_path, 'wb') as f:
        while True:
            chunk = await file.read(CHUNK_SIZE)
            if not chunk:
                break
            await f.write(chunk)

    return str(file_path)

async def create_thumbnail(file_path: str, room_id: str, file_id: str) -> str:
    """이미지 썸네일 생성 (200x200)"""
    try:
        img = Image.open(file_path)
        img = ImageOps.exif_transpose(img)
        img.thumbnail((200, 200), Image.Resampling.LANCZOS)

        room_dir = UPLOAD_DIR / room_id
        thumb_path = room_dir / f"{file_id}_thumb.jpg"
        img.save(thumb_path, "JPEG", quality=85)

        return str(thumb_path)
    except Exception as e:
        logger.error(f"[썸네일 생성 실패] {file_path} | {e}")
        return None

def validate_mime_type(mime_type: str) -> bool:
    """허용된 MIME 타입 검증"""
    allowed = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/zip', 'application/x-zip-compressed',
        'text/plain', 'text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    return mime_type in allowed
