@echo off
title Enterprise NeXus - Stop
cd /d "%~dp0"

echo Stopping Enterprise NeXus...
docker compose down

echo.
echo All services stopped.
pause
