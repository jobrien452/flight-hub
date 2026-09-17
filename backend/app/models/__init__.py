from app.models.user import User
from app.models.mission import Mission
from app.models.mission_report import MissionReport
from app.models.api_token import ApiToken
from app.models.drone import Drone

# list of Beanie document models, used to init_beanie
document_models = [User, Mission, MissionReport, ApiToken, Drone]
