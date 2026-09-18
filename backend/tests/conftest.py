import pytest
import pytest_asyncio
from beanie import init_beanie
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.main import app
from app.models import document_models
from app.models.mission import Mission, MissionStatus
from app.models.user import Role, User
from app.security import create_access_token


@pytest_asyncio.fixture(autouse=True)
async def mock_db():
    # fresh in-memory mongo per test, no docker needed
    client = AsyncMongoMockClient()
    await init_beanie(database=client["flyby_test"], document_models=document_models)
    yield


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def admin_user() -> User:
    user = User(name="Ada Admin", email="ada@flyby-robotics.dev", role=Role.ADMIN)
    await user.insert()
    return user


@pytest_asyncio.fixture
async def other_admin_user() -> User:
    user = User(name="Alec Admin", email="alec@flyby-robotics.dev", role=Role.ADMIN)
    await user.insert()
    return user


@pytest_asyncio.fixture
async def pilot_user() -> User:
    user = User(name="Pete Pilot", email="pete@flyby-robotics.dev", role=Role.PILOT)
    await user.insert()
    return user


@pytest_asyncio.fixture
async def other_pilot_user() -> User:
    user = User(name="Priya Pilot", email="priya@flyby-robotics.dev", role=Role.PILOT)
    await user.insert()
    return user


@pytest.fixture
def admin_headers(admin_user: User) -> dict:
    token = create_access_token(str(admin_user.id), admin_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_admin_headers(other_admin_user: User) -> dict:
    token = create_access_token(str(other_admin_user.id), other_admin_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def pilot_headers(pilot_user: User) -> dict:
    token = create_access_token(str(pilot_user.id), pilot_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def other_pilot_headers(other_pilot_user: User) -> dict:
    token = create_access_token(str(other_pilot_user.id), other_pilot_user.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def assigned_mission(admin_user: User, pilot_user: User) -> Mission:
    mission = Mission(
        name="Survey Site A",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id)],
    )
    await mission.insert()
    return mission


@pytest_asyncio.fixture
async def flyable_mission(admin_user: User, pilot_user: User) -> Mission:
    # assigned and published, the only shape a pilot can actually act on
    mission = Mission(
        name="Survey Site A",
        owner_id=str(admin_user.id),
        assigned_pilot_ids=[str(pilot_user.id)],
        status=MissionStatus.PUBLISHED,
    )
    await mission.insert()
    return mission


@pytest_asyncio.fixture
async def unassigned_mission(admin_user: User) -> Mission:
    mission = Mission(name="Survey Site B", owner_id=str(admin_user.id))
    await mission.insert()
    return mission


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    # the limiters live for the life of the process, one test's attempts should
    # not count against the next one's
    from app.routers.auth import LIMITERS

    for limiter in LIMITERS:
        limiter.clear()
    yield
