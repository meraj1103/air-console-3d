@echo off
title AIR-CONSOLE 3D - Hot Wheels Dual Mobile Controller
color 0B
cls
echo =====================================================================
echo   🏎️  AIR-CONSOLE 3D: DUAL MOBILE RACING SYSTEM FOR HOT WHEELS
echo =====================================================================
echo.
echo  [1/2] Starting Air-Console Server & Windows DirectInput Bridge...
cd /d "%~dp0"

:: Start Node.js server in the background
start /B node server.js

timeout /t 2 >nul

echo  [2/2] Launching Hot Wheels Unleashed directly (bypassing EAC)...
set GAME_DIR=M:\MJ\games\HOT.WHEELS.Infinite.Rush-SteamRIP.com\HOT.WHEELS.Infinite.Rush.v1859562
if exist "%GAME_DIR%\hotwheels3\Binaries\Win64\hotwheels3-Win64-Shipping.exe" (
    start "" "%GAME_DIR%\hotwheels3\Binaries\Win64\hotwheels3-Win64-Shipping.exe"
) else (
    echo Note: Launch Hot Wheels manually if not found at default path.
)

echo.
echo =====================================================================
echo   ✅ READY TO RACE!
echo =====================================================================
echo   1. Scan the QR code or open http://localhost:3000 in your browser.
echo   2. On your phone(s), connect to the Room Code shown on screen.
echo   3. In Hot Wheels: Go to Quick Modes -> Split Screen.
echo   4. Tap [GAS] (Green Button A) on phone to start racing!
echo =====================================================================
echo.
pause

