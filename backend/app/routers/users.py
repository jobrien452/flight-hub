from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.deps import CurrentUser, get_current_user, require_admin
from app.ids import to_object_id
from app.invites import send_invite
from app.mission_progress import complete_if_everyone_reported
from app.models.drone import Drone
from app.models.mission import Mission
from app.models.user import Role, User
from app.schemas.user import UserCreate, UserOut, UserUpdate
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


async def _get_user(user_id: str) -> User:
    oid = to_object_id(user_id)
    user = await User.get(oid) if oid else None
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return user


async def _claim_email(email: str, keeping: User | None = None) -> str:
    # addresses are compared as typed everywhere else, so settle the case here
    # rather than let one person hold two accounts
    email = email.lower()
    held_by = await User.find_one(User.email == email)
    if held_by is not None and (keeping is None or held_by.id != keeping.id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="that email already has an account"
        )
    return email


async def _release_pilot(pilot_id: str) -> None:
    # taken off everything they were down to fly, and anything that was only
    # waiting on them can now finish
    missions = await Mission.find(Mission.assigned_pilot_ids == pilot_id).to_list()
    for mission in missions:
        mission.assigned_pilot_ids = [p for p in mission.assigned_pilot_ids if p != pilot_id]
        mission.updated_at = datetime.now(timezone.utc)
        await mission.save()
        await complete_if_everyone_reported(str(mission.id))


async def _hand_over_work(from_admin: str, to_admin: str) -> None:
    # missions and aircraft are only visible to the admin who owns them, so
    # leaving them behind would put them where nobody can reach them
    for mission in await Mission.find(Mission.owner_id == from_admin).to_list():
        mission.owner_id = to_admin
        await mission.save()
    for drone in await Drone.find(Drone.owner_id == from_admin).to_list():
        drone.owner_id = to_admin
        await drone.save()


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


# the three below are off the published api. a token is for flying work, adding
# and removing people is something an admin does signed in
@router.post(
    "",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_user(
    payload: UserCreate, current_user: CurrentUser = Depends(require_admin)
) -> UserOut:
    email = await _claim_email(payload.email)

    user = User(name=payload.name, email=email, role=payload.role)
    if payload.password:
        user.password_hash = hash_password(payload.password)
        user.password_changed_at = datetime.now(timezone.utc)
    await user.insert()

    if user.password_hash is None:
        await send_invite(user)
    return _out(user)


@router.patch("/{user_id}", response_model=UserOut, include_in_schema=False)
async def update_user(
    user_id: str, payload: UserUpdate, current_user: CurrentUser = Depends(require_admin)
) -> UserOut:
    user = await _get_user(user_id)
    updates = payload.model_dump(exclude_unset=True, exclude_none=True)

    moved = False
    if "email" in updates:
        email = await _claim_email(updates["email"], keeping=user)
        moved = email != user.email
        updates["email"] = email

    for field, value in updates.items():
        setattr(user, field, value)
    await user.save()

    # an unclaimed invite went to the old address, so send it to the new one
    if moved and user.password_hash is None:
        await send_invite(user)
    return _out(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
async def delete_user(
    user_id: str, current_user: CurrentUser = Depends(require_admin)
) -> Response:
    user = await _get_user(user_id)
    if str(user.id) == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="you cannot remove your own account"
        )

    if user.role == Role.PILOT:
        await _release_pilot(str(user.id))
    else:
        await _hand_over_work(str(user.id), current_user.user_id)

    await user.delete()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
