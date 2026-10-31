from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from auth import RoleChecker
import models, schemas, database
from typing import List

router = APIRouter(prefix="/jobs", tags=["jobs"])
allow_view = RoleChecker(["user", "admin", "hiring_manager"])
allow_create = RoleChecker(["admin"])

@router.get("/", response_model=List[schemas.JobOut])
def get_jobs(db: Session = Depends(database.get_db), current_user: models.User = Depends(allow_view)):
    return db.query(models.Job).all()

@router.post("/", response_model=schemas.JobOut)
def create_job(job: schemas.JobCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(allow_create)):
    new_job = models.Job(**job.dict())
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job