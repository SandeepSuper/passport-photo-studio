@echo off
echo ===================================================
echo   Stopping existing Python servers (if any)...
echo ===================================================
taskkill /IM python.exe /F 2>nul

echo.
echo ===================================================
echo   Starting Passport Security Server...
echo   Please keep this window OPEN.
echo ===================================================
python server.py
pause
