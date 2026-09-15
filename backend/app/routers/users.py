from fastapi import APIRouter, Depends, Query

from app.deps import CurrentUser, require_admin
from app.models.user import Role, User
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])


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
