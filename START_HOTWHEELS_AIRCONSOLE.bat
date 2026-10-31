@echo off
title AIR-CONSOLE 3D - Hot Wheels Dual Mobile Controller
color 0B
cls
echo =====================================================================
echo   🏎️  AIR-CONSOLE 3D: DUAL MOBILE RACING SYSTEM FOR HOT WHEELS
echo =====================================================================
echo.
cd /d "%~dp0"

:: Check if ViGEmBus driver is installed (required for 2-player split screen)
sc query ViGEmBus >nul 2>&1
if %errorlevel% neq 0 (
    echo =====================================================================
    echo   [!] XBOX VIRTUAL CONTROLLER DRIVER SETUP REQUIRED FOR SPLIT SCREEN
    echo =====================================================================
    echo  Hot Wheels Unleashed requires virtual gamepads for 2-player split screen.
    echo  Launching driver installer... Please click 'Yes' on the prompt!
    echo.
    start /wait ViGEmBus_Setup.exe
    echo  Driver installation complete!
    echo =====================================================================
    echo.
)

echo  [1/2] Starting Air-Console Server & Windows Game Controller Bridge...
start /B node server.js

timeout /t 2 >nul

echo  [2/2] Launching Hot Wheels Unleashed...
set GAME_DIR=M:\MJ\games\HOT.WHEELS.Infinite.Rush-SteamRIP.com\HOT.WHEELS.Infinite.Rush.v1859562
if exist "%GAME_DIR%\hotwheels3\Binaries\Win64\hotwheels3-Win64-Shipping.exe" (
    start "" "%GAME_DIR%\hotwheels3\Binaries\Win64\hotwheels3-Win64-Shipping.exe"
) else (
    echo Note: Launch Hot Wheels manually if not found at default path.
)

echo.
echo =====================================================================
echo   ✅ READY TO RACE IN 2-PLAYER SPLIT SCREEN!
echo =====================================================================
echo   1. Scan the QR code or open http://localhost:3000 in your browser.
echo   2. On both phones, connect to the Room Code shown on screen.
echo   3. In Hot Wheels: Go to Quick Modes -> Split Screen.
echo   4. Player 2 taps [A] or [GAS] on phone to JOIN SPLIT SCREEN!
echo =====================================================================
echo.
pause
