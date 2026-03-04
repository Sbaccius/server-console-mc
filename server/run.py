import uvicorn
from main import app
import sys
import multiprocessing

if __name__ == "__main__":
    # Standard FastAPI/Uvicorn entry point
    # We use 0.0.0.0 to allow access from other devices if needed
    uvicorn.run(app, host="0.0.0.0", port=8000)
