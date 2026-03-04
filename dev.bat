@echo off
echo Starting Development Server for Minecraft Console...

echo [1/2] Starting Python Backend with Auto-Reload...
start cmd /k "cd server && call venv_build\Scripts\activate.bat && uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo [2/2] Starting React Frontend with Auto-Reload...
start cmd /k "cd client && npm run dev"

echo Development mode started! 
echo Due nuove finestre si sono aperte. Quando modifichi il codice, si aggiorneranno da sole!
echo Vai su: http://localhost:5173
