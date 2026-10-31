@echo off
title Install Xbox Virtual Controllers for Hot Wheels
color 0B
cd /d "%~dp0"

:: Check for Administrator Privileges; auto-elevate if needed
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [UAC] Requesting Administrator Privileges to install Xbox Controller driver...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ========================================================
echo   INSTALLING XBOX VIRTUAL CONTROLLERS FOR HOT WHEELS
echo ========================================================
echo.
echo Hot Wheels Unleashed on PC requires two Xbox gamepads for split screen.
echo Installing the official ViGEmBus driver...
echo.

if exist "ViGEmBus_Setup.exe" (
    start /wait ViGEmBus_Setup.exe /install /passive /norestart
) else (
    echo Error: ViGEmBus_Setup.exe not found in %~dp0
    pause
    exit /b
)

echo.
echo Checking driver status...
sc query ViGEmBus >nul 2>&1
if %errorlevel% equ 0 (
    echo ========================================================
    echo   [SUCCESS] VIRTUAL XBOX CONTROLLERS ARE INSTALLED!
    echo ========================================================
    echo Hot Wheels will now recognize BOTH mobile phones as separate Xbox 360 controllers!
    echo Phone 1 will drive Car 1.
    echo Phone 2 will drive Car 2 (NO MORE CAMERA ROTATION!).
) else (
    echo ========================================================
    echo   Setup finished. If prompted by installer, click 'Install'.
    echo ========================================================
)

echo.
echo Now start "start_hotwheels_bridge.bat" or "START_HOTWHEELS_AIRCONSOLE.bat"!
echo.
pause

