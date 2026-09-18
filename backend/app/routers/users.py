from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import CurrentUser, get_current_user, require_admin
from app.ids import to_object_id
from app.invites import send_invite
from app.models.user import Role, User
from app.schemas.user import UserCreate, UserOut
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


def _out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        name=user.name,
        email=user.email,
        role=user.role,
        has_password=user.password_hash is not None,
    )


@router.get("/me", response_model=UserOut)
async def read_me(current_user: CurrentUser = Depends(get_current_user)) -> UserOut:
    user = await User.get(to_object_id(current_user.user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return _out(user)


@router.get("", response_model=list[UserOut])
async def list_users(
    role: Role | None = Query(default=None),
    current_user: CurrentUser = Depends(require_admin),
) -> list[UserOut]:
    users = await (User.find(User.role == role) if role else User.find_all()).to_list()
    return [_out(u) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate, current_user: CurrentUser = Depends(require_admin)
) -> UserOut:
    # addresses are compared as typed everywhere else, so settle the case here
    # rather than let one person hold two accounts
    email = payload.email.lower()
    if await User.find_one(User.email == email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="that email already has an account"
        )

    user = User(name=payload.name, email=email, role=payload.role)
    if payload.password:
        user.password_hash = hash_password(payload.password)
        user.password_changed_at = datetime.now(timezone.utc)
    await user.insert()

    if user.password_hash is None:
        await send_invite(user)
    return _out(user)
