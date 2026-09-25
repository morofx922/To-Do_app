
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Task, Notification

scheduler = AsyncIOScheduler()


async def check_reminders():
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()
        
        pending_tasks = db.query(Task).filter(
            Task.reminder_at != None,
            Task.reminder_at <= now,
            Task.reminder_sent == False,
            Task.is_completed == False  
        ).all()
        
        for task in pending_tasks:
            
            notification = Notification(
                user_id=task.user_id,
                task_id=task.id,
                message=f'⏰ Reminder: "{task.title}" is due soon!'
            )
            db.add(notification)
            
            task.reminder_sent = True
            
            print(f"🔔 REMINDER FIRED: {task.title} for user {task.user_id}")
        
        db.commit()
    except Exception as e:
        print(f"❌ Scheduler error: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Start the background scheduler."""
    scheduler.add_job(
        check_reminders,
        trigger=IntervalTrigger(seconds=60), 
        id="reminder_checker",
        name="Check for due task reminders",
        replace_existing=True
    )
    scheduler.start()
    print("⏰ Reminder scheduler started (checking every 60 seconds)")


def stop_scheduler():
    """Stop the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown()
        print("⏰ Reminder scheduler stopped")