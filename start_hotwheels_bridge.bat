@echo off
title Hot Wheels PC Virtual Gamepad Bridge
color 0A
echo ========================================================
echo   AIR-CONSOLE 3D - HOT WHEELS XBOX CONTROLLER BRIDGE
echo ========================================================
echo.
cd /d "%~dp0"

:: Check if ViGEmBus driver is installed
sc query ViGEmBus >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Installing ViGEmBus Xbox Controller driver for Split Screen...
    start /wait ViGEmBus_Setup.exe
)

echo Starting Virtual Xbox 360 Controller Bridge...
python windows_game_bridge.py
pause
