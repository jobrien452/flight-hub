from app.models.user import User
from app.models.mission import Mission
from app.models.mission_report import MissionReport

# list of Beanie document models, used to init_beanie
document_models = [User, Mission, MissionReport]
