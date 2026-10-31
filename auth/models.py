from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum

class RoleEnum(str, enum.Enum):
    user = "user"
    admin = "admin"
    hiring_manager = "hiring_manager"

class RuleType(str, enum.Enum): #[cite: 1]
    location = "Location"
    years_of_experience = "Years of Experience"
    license = "License"

class ActionEnum(str, enum.Enum): #[cite: 1]
    fail = "Fail"
    review = "Review"
    pass_action = "Pass"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(Enum(RoleEnum), default=RoleEnum.user)

    applications = relationship("Application", back_populates="user")

class Job(Base):
    __tablename__ = "jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True) #[cite: 2, 6]
    description = Column(Text) #[cite: 2, 6]
    location = Column(String) #[cite: 2, 6]
    created_at = Column(DateTime(timezone=True), server_default=func.now()) #[cite: 6]

    forms = relationship("Form", back_populates="job") #[cite: 6]
    rules = relationship("Rule", back_populates="job") #[cite: 6]
    applications = relationship("Application", back_populates="job") #[cite: 6]

class Form(Base):
    __tablename__ = "forms"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id")) #[cite: 5]
    title = Column(String) #[cite: 2, 5]
    description = Column(Text) #[cite: 2, 5]

    job = relationship("Job", back_populates="forms") #[cite: 5]
    questions = relationship("Question", back_populates="form") #[cite: 5]

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id")) #[cite: 5]
    text = Column(String) #[cite: 2, 5]
    type = Column(String) #[cite: 2, 5]
    is_required = Column(Boolean, default=True) #[cite: 2, 5]

    form = relationship("Form", back_populates="questions") #[cite: 5]
    answers = relationship("Answer", back_populates="question")

class Rule(Base):
    __tablename__ = "rules"
    
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id")) #[cite: 3]
    type = Column(Enum(RuleType)) #[cite: 1, 3]
    target_value = Column(String) #[cite: 1, 3]
    action_if_not_met = Column(Enum(ActionEnum)) #[cite: 1, 3]
    custom_message = Column(String) #[cite: 1, 3]

    job = relationship("Job", back_populates="rules") #[cite: 3]

class Application(Base):
    __tablename__ = "applications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id")) #[cite: 3]
    job_id = Column(Integer, ForeignKey("jobs.id")) #[cite: 3]
    status = Column(String, default="Pending") #[cite: 3]
    submitted_at = Column(DateTime(timezone=True), server_default=func.now()) #[cite: 3]

    user = relationship("User", back_populates="applications")
    job = relationship("Job", back_populates="applications")
    answers = relationship("Answer", back_populates="application") #[cite: 3]
    results = relationship("ScreeningResult", back_populates="application") #[cite: 3]

class Answer(Base):
    __tablename__ = "answers"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id")) #[cite: 4]
    question_id = Column(Integer, ForeignKey("questions.id")) #[cite: 4]
    response_value = Column(Text) #[cite: 4]

    application = relationship("Application", back_populates="answers") #[cite: 4]
    question = relationship("Question", back_populates="answers") #[cite: 4]

class ScreeningResult(Base):
    __tablename__ = "screening_results"
    
    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("applications.id")) #[cite: 4]
    overall_status = Column(String) #[cite: 4]
    results_detail = Column(JSON) #[cite: 4]
    overridden_by_id = Column(Integer, ForeignKey("users.id"), nullable=True) #[cite: 4]
    override_comment = Column(Text, nullable=True) #[cite: 4]
    created_at = Column(DateTime(timezone=True), server_default=func.now()) #[cite: 4]

    application = relationship("Application", back_populates="results") #[cite: 4]
    overridden_by = relationship("User")