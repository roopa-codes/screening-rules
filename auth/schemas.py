from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
from datetime import datetime
import models

# --- AUTH ---
class UserLogin(BaseModel):
    email: EmailStr
    password: str
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    role: models.RoleEnum
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

# --- CORE DOMAIN ---
class JobBase(BaseModel):
    title: str
    description: str
    location: str

class JobCreate(JobBase):
    pass

class JobOut(JobBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

class FormBase(BaseModel):
    title: str
    description: str
    job_id: int

class FormCreate(FormBase):
    pass

class FormOut(FormBase):
    id: int
    class Config:
        from_attributes = True

class QuestionBase(BaseModel):
    text: str
    type: str
    is_required: bool = True
    form_id: int

class QuestionCreate(QuestionBase):
    pass

class QuestionOut(QuestionBase):
    id: int
    class Config:
        from_attributes = True

class RuleBase(BaseModel):
    job_id: int
    type: models.RuleType
    target_value: str
    action_if_not_met: models.ActionEnum
    custom_message: str

class RuleCreate(RuleBase):
    pass

class RuleOut(RuleBase):
    id: int
    class Config:
        from_attributes = True

class AnswerCreate(BaseModel):
    question_id: int
    response_value: str

class ApplicationCreate(BaseModel):
    job_id: int
    answers: List[AnswerCreate]