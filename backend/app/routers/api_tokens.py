from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.ids import to_object_id
from app.deps import CurrentUser, require_session
from app.models.api_token import ApiToken
from app.schemas.api_token import ApiTokenCreate, ApiTokenCreated, ApiTokenOut
from app.security import api_token_prefix, generate_api_token, hash_api_token

router = APIRouter(prefix="/api-tokens", tags=["api-tokens"])


def _out(token: ApiToken) -> ApiTokenOut:
    return ApiTokenOut(
        id=str(token.id),
        name=token.name,
        prefix=token.prefix,
        created_at=token.created_at,
        last_used_at=token.last_used_at,
    )


@router.get("", response_model=list[ApiTokenOut])
async def list_api_tokens(
    current_user: CurrentUser = Depends(require_session),
) -> list[ApiTokenOut]:
    tokens = await ApiToken.find(ApiToken.user_id == current_user.user_id).to_list()
    return [_out(t) for t in tokens]


@router.post("", response_model=ApiTokenCreated, status_code=status.HTTP_201_CREATED)
async def create_api_token(
    payload: ApiTokenCreate,
    current_user: CurrentUser = Depends(require_session),
) -> ApiTokenCreated:
    secret = generate_api_token()
    token = ApiToken(
        user_id=current_user.user_id,
        name=payload.name,
        token_hash=hash_api_token(secret),
        prefix=api_token_prefix(secret),
    )
    await token.insert()
    return ApiTokenCreated(**_out(token).model_dump(), token=secret)


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_api_token(
    token_id: str,
    current_user: CurrentUser = Depends(require_session),
) -> None:
    oid = to_object_id(token_id)
    if oid is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    token = await ApiToken.get(oid)
    # someone else's token reads as missing rather than forbidden
    if token is None or token.user_id != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    await token.delete()
