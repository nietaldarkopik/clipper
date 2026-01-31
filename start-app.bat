@echo off
setlocal

echo ==========================================
echo       STARTING CLIPPER AI SYSTEM
echo ==========================================

:: Check if node_modules exists
if not exist "node_modules" (
    echo [INFO] Dependencies not found. Installing...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b %ERRORLEVEL%
    )
    echo [INFO] Dependencies installed successfully.
)

:: Check if .env exists, if not copy from example
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy .env.example .env
    ) else (
        echo [WARNING] .env file not found and .env.example is missing.
    )
)

echo [1/3] Launching Backend Server (Port 3000)...
start "Clipper Backend" cmd /k "npm run dev:backend"

echo [2/3] Launching Renderer (Vite Port 5173)...
start "Clipper Frontend" cmd /k "npm run dev:renderer"

echo [3/3] Launching Electron App...
echo Waiting for services to be ready...
call npm run dev:main

pause
