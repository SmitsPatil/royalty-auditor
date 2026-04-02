import os
import sys

# Add the backend directory to the python path so imports like `from app.routes import ...` work
backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_dir)

from app.main import app
