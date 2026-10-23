@echo off
setlocal
title Enterprise NeXus - Local Development
cd /d "%~dp0"

echo ============================================
echo   Enterprise NeXus - Local Development Stack
echo ============================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
    echo Docker was not found. Install Docker Desktop and try again.
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo Docker Desktop is not running. Start it and try again.
    pause
    exit /b 1
)

if not exist "backend\.env" (
    echo Missing backend\.env
    echo Copy backend\.env.example to backend\.env and add your local values.
    pause
    exit /b 1
)

if not exist "frontend\.env.local" (
    echo Missing frontend\.env.local
    echo Copy frontend\.env.example to frontend\.env.local and add your local values.
    pause
    exit /b 1
)

echo Building and starting the local services...
docker compose up -d --build
if errorlevel 1 (
    echo.
    echo The stack could not start. Review the Docker output above.
    pause
    exit /b 1
)

echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:5000
echo Health:   http://localhost:5000/api/health
echo n8n:      http://localhost:5678
echo.
start "" http://localhost:3000
echo Stack is running. Use stop.bat to stop the containers.
pause
endlocal
