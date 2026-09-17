from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.deps import CurrentUser, get_current_user

router = APIRouter(prefix="/config", tags=["config"])


# the map token is public by nature, mapbox-gl sends it from the browser on every
# tile request. handing it out here rather than baking it into the bundle keeps it
# away from anyone who is not signed in, and means rotating it is an env change
# on this service instead of a frontend rebuild and redeploy
@router.get("/map-token")
async def map_token(current_user: CurrentUser = Depends(get_current_user)) -> dict[str, str]:
    if not settings.mapbox_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="no mapbox token configured on this server",
        )
    return {"token": settings.mapbox_token}
