from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from auth import RoleChecker
import models, schemas, database
from typing import List

router = APIRouter(prefix="/forms", tags=["forms"])
allow_manage = RoleChecker(["admin"])

@router.get("/", response_model=List[schemas.FormOut])
def get_forms(db: Session = Depends(database.get_db), current_user: models.User = Depends(allow_manage)):
    return db.query(models.Form).all()

@router.post("/", response_model=schemas.FormOut)
def create_form(form: schemas.FormCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(allow_manage)):
    new_form = models.Form(**form.dict())
    db.add(new_form)
    db.commit()
    db.refresh(new_form)
    return new_form