@echo off
setlocal
title Enterprise NeXus - Stop Local Stack
cd /d "%~dp0"

echo Stopping Enterprise NeXus containers...
docker compose down --remove-orphans
if errorlevel 1 (
    echo.
    echo Docker could not stop the stack. Confirm Docker Desktop is running.
    pause
    exit /b 1
)

echo.
echo All Enterprise NeXus services are stopped.
echo The local n8n data volume was preserved.
pause
endlocal
