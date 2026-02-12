from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class AiChatMessage(BaseModel):
    role: str
    content: str

class AiChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    history: list[AiChatMessage] | None = None

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    position: str = Field(..., max_length=50)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    role: str = Field(default="user")

class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    position: Optional[str] = Field(None, max_length=50)
    role: Optional[str] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    email: Optional[str] = None
    role: str
    is_active: bool
    approval_status: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class EventLog(BaseModel):
    action: str

class CommentCreate(BaseModel):
    text: str = Field(..., min_length=1)

class CommentResponse(BaseModel):
    id: int
    post_id: int
    author: str
    text: str
    date: str

    class Config:
        from_attributes = True

class PostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    category: str = Field(default="general")
    content: str = Field(..., min_length=1)

class PostResponse(BaseModel):
    id: int
    category: str
    title: str
    content: str
    author: str
    date: str
    views: int
    likes: int
    comments: list[CommentResponse]

    class Config:
        from_attributes = True

class CheckEmailRequest(BaseModel):
    email: str = Field(..., min_length=1)

class SendOtpRequest(BaseModel):
    email: str = Field(..., min_length=1)

class VerifyOtpRequest(BaseModel):
    email: str = Field(..., min_length=1)
    otp: str = Field(..., min_length=6, max_length=6)

class SignupRequest(BaseModel):
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1, max_length=100)

class InventoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: str = Field(..., min_length=1)
    quantity: int = Field(..., ge=0)
    low_stock_threshold: int = Field(default=10, ge=0)
    location: Optional[str] = Field(None, max_length=100)

class InventoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = None
    quantity: Optional[int] = Field(None, ge=0)
    low_stock_threshold: Optional[int] = Field(None, ge=0)
    location: Optional[str] = Field(None, max_length=100)

class InventoryResponse(BaseModel):
    id: int
    name: str
    category: str
    quantity: int
    low_stock_threshold: int
    location: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatRoomCreate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    type: str = Field(default="group")
    member_ids: Optional[List[int]] = None

class ChatRoomResponse(BaseModel):
    id: str
    name: str
    type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    id: int
    room_id: str
    user_id: int
    user_name: str
    content: Optional[str]
    type: str
    file_id: Optional[str]
    created_at: str
    read_by: List[int]

class ChatReadRequest(BaseModel):
    room_id: str
    message_ids: List[int]

class FileUploadResponse(BaseModel):
    file_id: str
    filename: str
    thumbnail: Optional[str]

class UserSearchResponse(BaseModel):
    id: int
    name: str
    email: Optional[str]