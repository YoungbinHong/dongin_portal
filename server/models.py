from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, BigInteger, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
import uuid

class OTP(Base):
    __tablename__ = "otps"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    position = Column(String(50), nullable=False)
    role = Column(String(20), default="user", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    approval_status = Column(String(20), default="approved", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_heartbeat = Column(DateTime(timezone=True), nullable=True)

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(20), nullable=False, default="general")
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String(50), nullable=False)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan", order_by="Comment.created_at")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    author = Column(String(50), nullable=False)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    post = relationship("Post", back_populates="comments")

class Inventory(Base):
    __tablename__ = "inventory"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(50), nullable=False)
    quantity = Column(Integer, default=0, nullable=False)
    low_stock_threshold = Column(Integer, default=10, nullable=False)
    location = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    type = Column(String(10), default="group", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    members = relationship("ChatRoomMember", back_populates="room", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="room", cascade="all, delete-orphan")

class ChatRoomMember(Base):
    __tablename__ = "chat_room_members"

    room_id = Column(Integer, ForeignKey("chat_rooms.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    last_read_id = Column(BigInteger, nullable=True)

    room = relationship("ChatRoom", back_populates="members")
    user = relationship("User")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("chat_rooms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=True)
    type = Column(String(10), default="text", nullable=False)
    file_id = Column(String(36), nullable=True)
    reply_to = Column(BigInteger, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    room = relationship("ChatRoom", back_populates="messages")
    user = relationship("User")
    file = relationship("ChatFile", back_populates="message", uselist=False)
    read_receipts = relationship("ChatReadReceipt", back_populates="message", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_room_created', 'room_id', 'created_at'),
    )

class ChatFile(Base):
    __tablename__ = "chat_files"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(BigInteger, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=True)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(100), nullable=False)
    size = Column(BigInteger, nullable=False)
    path = Column(String(500), nullable=False)
    thumbnail_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    message = relationship("ChatMessage", back_populates="file")

class ChatReadReceipt(Base):
    __tablename__ = "chat_read_receipts"

    message_id = Column(BigInteger, ForeignKey("chat_messages.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    read_at = Column(DateTime(timezone=True), server_default=func.now())

    message = relationship("ChatMessage", back_populates="read_receipts")
    user = relationship("User")

class PostView(Base):
    __tablename__ = "post_views"

    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    viewed_at = Column(DateTime(timezone=True), server_default=func.now())

class AiChatLog(Base):
    __tablename__ = "ai_chat_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(36), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
