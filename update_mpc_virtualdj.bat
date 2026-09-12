@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Mise a jour MPC Studio - VirtualDJ

set "DEST=%~dp0"
set "ZIP=%TEMP%\MPC-Studio-main.zip"
set "TMPDIR=%TEMP%\MPC-Studio-update"

echo.
echo =============================================
echo   Mise a jour MPC Studio + VirtualDJ
echo =============================================
echo.
echo Ferme d'abord l'ancienne fenetre du bridge.
echo Mise a jour depuis GitHub...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue';" ^
  "Invoke-WebRequest -Uri 'https://github.com/kertousr-hue/Mpc/archive/refs/heads/main.zip' -OutFile '%ZIP%';" ^
  "Remove-Item -Recurse -Force '%TMPDIR%' -ErrorAction SilentlyContinue;" ^
  "New-Item -ItemType Directory -Path '%TMPDIR%' -Force | Out-Null;" ^
  "Expand-Archive -Path '%ZIP%' -DestinationPath '%TMPDIR%' -Force;" ^
  "Copy-Item -Path '%TMPDIR%\Mpc-main\*' -Destination '%DEST%' -Recurse -Force;" ^
  "Remove-Item -Force '%ZIP%' -ErrorAction SilentlyContinue;" ^
  "Remove-Item -Recurse -Force '%TMPDIR%' -ErrorAction SilentlyContinue"

if errorlevel 1 (
  echo.
  echo ERREUR pendant la mise a jour.
  echo Verifie la connexion Internet puis recommence.
  pause
  exit /b 1
)

echo.
echo Mise a jour terminee.
echo Lancement du nouveau bridge VirtualDJ...
echo.
call "%DEST%start_virtualdj_bridge.bat"

endlocal
