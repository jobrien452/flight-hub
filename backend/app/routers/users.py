from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.deps import CurrentUser, get_current_user, require_admin
from app.models.user import Role, User
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def read_me(current_user: CurrentUser = Depends(get_current_user)) -> UserOut:
    user = await User.get(current_user.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return UserOut(
        id=str(user.id),
        name=user.name,
        email=user.email,
        role=user.role,
        has_password=user.password_hash is not None,
    )


@router.get("", response_model=list[UserOut])
async def list_users(
    role: Role | None = Query(default=None),
    current_user: CurrentUser = Depends(require_admin),
) -> list[UserOut]:
    users = await (User.find(User.role == role) if role else User.find_all()).to_list()
    return [
        UserOut(
            id=str(u.id),
            name=u.name,
            email=u.email,
            role=u.role,
            has_password=u.password_hash is not None,
        )
        for u in users
    ]
