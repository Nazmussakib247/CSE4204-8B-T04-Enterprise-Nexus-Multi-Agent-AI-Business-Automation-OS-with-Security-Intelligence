@echo off
title Enterprise NeXus
cd /d "%~dp0"

echo ============================================
echo   Enterprise NeXus - Starting all services
echo ============================================
echo.

docker compose up -d --build
if errorlevel 1 (
    echo.
    echo Something went wrong. Is Docker Desktop running?
    pause
    exit /b 1
)

echo.
echo Waiting for services to come up...
timeout /t 8 /nobreak >nul

echo.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:5000
echo   n8n:      http://localhost:5678  (admin/changeme)
echo.

start "" http://localhost:3000

echo Stack is running. Close this window any time - containers keep running.
echo To stop everything, double-click stop.bat
echo.
pause
