#!/bin/bash

# Minecraft Server Console - Linux Build Script
# This script builds the React frontend and packages it with the Python backend into a single binary.

set -e

echo "--- Starting Build Process ---"

# 1. Build Frontend
echo "Building Frontend..."
cd client
npm install
npm run build
cd ..

# 2. Setup Python Environment
echo "Setting up Python environment..."
cd server
python3 -m venv venv_build
source venv_build/bin/activate
pip install -r requirements.txt
pip install pyinstaller

# 3. Build Executable
echo "Building Single Binary with PyInstaller..."
# We bundle the client/dist folder into the executable
pyinstaller --name "mc-console" \
            --onefile \
            --add-data "../client/dist:client/dist" \
            run.py

echo "--- Build Complete! ---"
echo "Your executable is located at: server/dist/mc-console"
echo "You can move this file anywhere and run it."
