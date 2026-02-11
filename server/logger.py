import logging
import sys
import os
from datetime import datetime, timezone, timedelta
from logging.handlers import RotatingFileHandler
from pathlib import Path

SEOUL_TZ = timezone(timedelta(hours=9))
LOG_DIR = Path(__file__).parent / "logs"
LOG_DIR.mkdir(exist_ok=True)

class SeoulFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        ct = datetime.fromtimestamp(record.created, tz=SEOUL_TZ)
        return ct.strftime(datefmt or "%Y-%m-%d %H:%M:%S")

def setup_logger():
    # 시스템 로거
    system_logger = logging.getLogger("system")
    system_logger.setLevel(logging.INFO)
    system_logger.propagate = False

    formatter = SeoulFormatter("[%(levelname)s] %(asctime)s | %(message)s")

    # 콘솔 핸들러
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(SeoulFormatter("%(asctime)s | %(message)s"))
    system_logger.addHandler(console)

    # 시스템 로그 파일 (10MB, 5개 백업)
    system_file = RotatingFileHandler(
        LOG_DIR / "system.log",
        maxBytes=10*1024*1024,
        backupCount=5,
        encoding="utf-8"
    )
    system_file.setFormatter(formatter)
    system_logger.addHandler(system_file)

    # 에러 로그 파일
    error_file = RotatingFileHandler(
        LOG_DIR / "error.log",
        maxBytes=10*1024*1024,
        backupCount=5,
        encoding="utf-8"
    )
    error_file.setLevel(logging.ERROR)
    error_file.setFormatter(formatter)
    system_logger.addHandler(error_file)

    return system_logger

def get_access_logger():
    """API 요청/응답 전용 로거"""
    access_logger = logging.getLogger("access")
    if access_logger.handlers:
        return access_logger

    access_logger.setLevel(logging.INFO)
    access_logger.propagate = False

    # access.log 파일
    access_file = RotatingFileHandler(
        LOG_DIR / "access.log",
        maxBytes=10*1024*1024,
        backupCount=5,
        encoding="utf-8"
    )
    access_file.setFormatter(SeoulFormatter("%(asctime)s | %(message)s"))
    access_logger.addHandler(access_file)

    return access_logger

def get_event_logger():
    """이벤트 전용 로거"""
    event_logger = logging.getLogger("event")
    if event_logger.handlers:
        return event_logger

    event_logger.setLevel(logging.INFO)
    event_logger.propagate = False

    # 콘솔 출력
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(SeoulFormatter("%(asctime)s | %(message)s"))
    event_logger.addHandler(console)

    # event.log 파일
    event_file = RotatingFileHandler(
        LOG_DIR / "event.log",
        maxBytes=10*1024*1024,
        backupCount=5,
        encoding="utf-8"
    )
    event_file.setFormatter(SeoulFormatter("%(asctime)s | %(message)s"))
    event_logger.addHandler(event_file)

    return event_logger

def get_user_logger(username: str):
    """유저별 로거 반환"""
    logger_name = f"user.{username}"
    user_logger = logging.getLogger(logger_name)

    if user_logger.handlers:
        return user_logger

    user_logger.setLevel(logging.INFO)
    user_logger.propagate = False

    user_dir = LOG_DIR / "users"
    user_dir.mkdir(exist_ok=True)

    # 유저별 로그 파일 (5MB, 3개 백업)
    handler = RotatingFileHandler(
        user_dir / f"{username}.log",
        maxBytes=5*1024*1024,
        backupCount=3,
        encoding="utf-8"
    )
    handler.setFormatter(SeoulFormatter("%(asctime)s | %(message)s"))
    user_logger.addHandler(handler)

    return user_logger

# 시스템 로거 초기화
logger = setup_logger()
