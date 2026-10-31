from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from auth import RoleChecker, get_current_user
import models, schemas, database

router = APIRouter(prefix="/applications", tags=["applications"])

@router.post("/")
def submit_application(app: schemas.ApplicationCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != models.RoleEnum.user:
        raise HTTPException(status_code=403, detail="Only users can apply.")
    
    new_app = models.Application(user_id=current_user.id, job_id=app.job_id)
    db.add(new_app)
    db.flush() 
    
    for answer in app.answers:
        new_answer = models.Answer(
            application_id=new_app.id,
            question_id=answer.question_id,
            response_value=answer.response_value
        )
        db.add(new_answer)
    
    db.commit()
    return {"message": "Application submitted successfully", "application_id": new_app.id}