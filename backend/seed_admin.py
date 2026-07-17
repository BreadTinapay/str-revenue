"""One-time setup: create the first admin user.

Usage (inside the api container):
    python seed_admin.py admin@example.com yourpassword
"""
import sys
import uuid

from app.auth.security import hash_password
from app.db import SessionLocal
from app.models import User


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python seed_admin.py <email> <password>")
        sys.exit(1)

    email, password = sys.argv[1], sys.argv[2]
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"User {email} already exists (role={existing.role})")
            return

        user = User(id=uuid.uuid4(), email=email, password_hash=hash_password(password), role="admin")
        db.add(user)
        db.commit()
        print(f"Created admin user {email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
