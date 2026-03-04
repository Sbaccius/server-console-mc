@echo off
echo --- Starting Build Process for Windows ---

echo Building Frontend...
cd client
call npm install
call npm run build
cd ..

echo Setting up Python environment...
cd server
python -m venv venv_build
call venv_build\Scripts\activate.bat
pip install -r requirements.txt
pip install pyinstaller

echo Building Single Binary with PyInstaller...
pyinstaller --name "mc-console" --onefile --add-data "../client/dist;client/dist" run.py

echo --- Build Complete! ---
echo Your executable is located at: server\dist\mc-console.exe
echo You can move this file anywhere and run it.
pause
