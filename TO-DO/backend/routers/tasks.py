
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List
from database import get_db
from models import Task, User, Notification
from schemas import TaskCreate, TaskResponse
from auth import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

WEIGHT_MAP = {"high": 3, "medium": 2, "low": 1}


@router.get("/", response_model=List[TaskResponse])
def get_tasks(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    tasks = db.query(Task).filter(Task.user_id == current_user.id).order_by(
        desc(Task.weight), asc(Task.title)
    ).all()
    return tasks


@router.post("/", response_model=TaskResponse, status_code=201)
def create_task(task: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    reminder_at = None
    if task.reminder_minutes:
        reminder_at = datetime.utcnow() + timedelta(minutes=task.reminder_minutes)

    new_task = Task(
        user_id=current_user.id,
        title=task.title,
        category=task.category,
        priority=task.priority,
        weight=WEIGHT_MAP[task.priority.value],
        reminder_at=reminder_at,
        reminder_sent=False
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    notification = Notification(
        user_id=current_user.id,
        task_id=new_task.id,
        message=f'New task added: "{task.title}"' + (
            f' (Reminder set for {task.reminder_minutes} min)' if task.reminder_minutes else ''
        )
    )
    db.add(notification)
    db.commit()

    return new_task


@router.put("/{task_id}/toggle")
def toggle_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_completed = not task.is_completed
    
    if not task.is_completed and task.reminder_at:
        task.reminder_sent = False
    db.commit()
    return {"message": "Task updated", "is_completed": task.is_completed}


@router.delete("/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"message": "Task deleted"}