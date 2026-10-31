from fastapi import FastAPI
from database import engine
import models
from routers import users, jobs, forms, questions, rules, applications

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Knockout Screening Service")

app.include_router(users.router)
app.include_router(jobs.router)
app.include_router(forms.router)
app.include_router(questions.router)
app.include_router(rules.router)
app.include_router(applications.router)