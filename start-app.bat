@echo off
echo ==========================================
echo       STARTING CLIPPER AI SYSTEM
echo ==========================================

echo [1/3] Launching Backend Server (Port 3000)...
start "Clipper Backend" cmd /k "npm run dev:backend"

echo [2/3] Launching Renderer (Vite Port 5173)...
start "Clipper Frontend" cmd /k "npm run dev:renderer"

echo [3/3] Launching Electron App...
echo Waiting for services to be ready...
call npm run dev:main

pause
