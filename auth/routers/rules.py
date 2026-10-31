from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from auth import RoleChecker
import models, schemas, database
from typing import List

router = APIRouter(prefix="/rules", tags=["rules"])
allow_manage = RoleChecker(["admin", "hiring_manager"])

@router.post("/", response_model=schemas.RuleOut)
def create_rule(rule: schemas.RuleCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(allow_manage)):
    new_rule = models.Rule(**rule.dict())
    db.add(new_rule)
    db.commit()
    db.refresh(new_rule)
    return new_rule