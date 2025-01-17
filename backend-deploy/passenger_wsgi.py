import os
import sys

# Add your python version path from Hostgator
INTERP = os.path.expanduser("/home/YOUR_USERNAME/virtualenv/backend/3.8/bin/python")
if sys.executable != INTERP:
    os.execl(INTERP, INTERP, *sys.argv)

# Add the application directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import your FastAPI app
from main import app

# Create WSGI app
application = app
