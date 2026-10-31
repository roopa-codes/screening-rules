from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
import models, schemas, auth, database

router = APIRouter(tags=["auth"])

def assign_role_by_email(email: str) -> models.RoleEnum:
    domain = email.split('@')[-1].lower()
    if domain == "hr.phen.com":
        return models.RoleEnum.hiring_manager
    elif domain == "phen.com":
        return models.RoleEnum.admin
    return models.RoleEnum.user

@router.post("/register", response_model=schemas.UserOut)
def register(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    assigned_role = assign_role_by_email(user.email)
    hashed_password = auth.get_password_hash(user.password)
    
    new_user = models.User(
        email=user.email, 
        hashed_password=hashed_password, 
        role=assigned_role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/login", response_model=schemas.Token)
def login(user_credentials: schemas.UserLogin, db: Session = Depends(database.get_db)):
    # Now we look up by user_credentials.email directly
    user = db.query(models.User).filter(models.User.email == user_credentials.email).first()
    
    if not user or not auth.verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
        
    access_token = auth.create_access_token(
        data={"sub": user.email, "role": user.role.value},
        expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}