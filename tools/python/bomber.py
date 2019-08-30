from hawkpython.hawkcatcher import Hawk
from dotenv import load_dotenv
import os
load_dotenv()

CATCHER_HOST = os.getenv("CATCHER_HOST")
CATCHER_TOKEN = os.getenv("CATCHER_TOKEN")

hawk = Hawk({
    'token': CATCHER_TOKEN,
    'host': CATCHER_HOST,
    'path': '/',
    'secure': False,
})

try:
    1/0;
except:
    hawk.catch()

