"""
Preloads pilot/admin emails as pending invites, no password yet.
Edit PRELOADED_USERS with real emails before running this against a real db.
"""

name = "0001_preload_invited_users"
dependencies = []

PRELOADED_USERS = [
    {"name": "Ada Admin", "email": "ada@flyby-robotics.dev", "role": "admin"},
    {"name": "Pete Pilot", "email": "pete@flyby-robotics.dev", "role": "pilot"},
]


def upgrade(db):
    for user in PRELOADED_USERS:
        db.users.update_one(
            {"email": user["email"]},
            {"$setOnInsert": {**user, "password_hash": None}},
            upsert=True,
        )


def downgrade(db):
    db.users.delete_many({"email": {"$in": [u["email"] for u in PRELOADED_USERS]}})
