
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional
from models import PriorityEnum, CategoryEnum


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    category: CategoryEnum
    priority: PriorityEnum = PriorityEnum.medium
    reminder_minutes: Optional[int] = Field(None, ge=1, le=43200)


class TaskResponse(BaseModel):
    id: int
    title: str
    category: CategoryEnum
    priority: PriorityEnum
    weight: int
    is_completed: bool
    due_date: Optional[datetime] = None
    reminder_at: Optional[datetime] = None
    reminder_sent: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True