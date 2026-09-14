from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import CurrentUser, get_current_user, require_admin
from app.schemas.mission import MissionCreate, MissionOut, MissionUpdate

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("", response_model=list[MissionOut])
async def list_missions(current_user: CurrentUser = Depends(get_current_user)) -> list[MissionOut]:
    # admin sees all missions, pilot sees only assigned ones
    # tests in tests/test_missions.py define the contract
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.get("/{mission_id}", response_model=MissionOut)
async def get_mission(
    mission_id: str, current_user: CurrentUser = Depends(get_current_user)
) -> MissionOut:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.post("", response_model=MissionOut, status_code=status.HTTP_201_CREATED)
async def create_mission(
    payload: MissionCreate, current_user: CurrentUser = Depends(require_admin)
) -> MissionOut:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.patch("/{mission_id}", response_model=MissionOut)
async def update_mission(
    mission_id: str,
    payload: MissionUpdate,
    current_user: CurrentUser = Depends(require_admin),
) -> MissionOut:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


@router.delete("/{mission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mission(
    mission_id: str, current_user: CurrentUser = Depends(require_admin)
) -> None:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)
