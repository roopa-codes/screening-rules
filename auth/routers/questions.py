from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from auth import RoleChecker
import models, schemas, database
from typing import List

router = APIRouter(prefix="/questions", tags=["questions"])
allow_view = RoleChecker(["admin", "hiring_manager"])
allow_create = RoleChecker(["admin"])

@router.get("/", response_model=List[schemas.QuestionOut])
def get_questions(db: Session = Depends(database.get_db), current_user: models.User = Depends(allow_view)):
    return db.query(models.Question).all()

@router.post("/", response_model=schemas.QuestionOut)
def create_question(question: schemas.QuestionCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(allow_create)):
    new_question = models.Question(**question.dict())
    db.add(new_question)
    db.commit()
    db.refresh(new_question)
    return new_question