from beanie import PydanticObjectId
from bson.errors import InvalidId


def to_object_id(value: str | None) -> PydanticObjectId | None:
    """An id from a url or a payload, or None when it was never an id at all.

    bson raises InvalidId rather than ValueError, so catching ValueError alone
    let a malformed id through as a 500 instead of the 404 it should be.
    """
    if not value:
        return None
    try:
        return PydanticObjectId(value)
    except (InvalidId, ValueError, TypeError):
        return None
