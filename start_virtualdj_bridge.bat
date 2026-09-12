@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title MPC Studio - VirtualDJ Bridge AUTO UPDATE

echo.
echo ================================================
echo   MPC Studio - VirtualDJ Bridge
echo   Mise a jour automatique depuis GitHub
echo ================================================
echo.

set "MPC_ZIP=%TEMP%\MPC-Studio-main.zip"
set "MPC_TMP=%TEMP%\MPC-Studio-auto-update"

echo [AUTO-UPDATE] Recherche de la derniere version GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri 'https://github.com/kertousr-hue/Mpc/archive/refs/heads/main.zip' -OutFile '%MPC_ZIP%'; Remove-Item -Recurse -Force '%MPC_TMP%' -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Path '%MPC_TMP%' -Force | Out-Null; Expand-Archive -Path '%MPC_ZIP%' -DestinationPath '%MPC_TMP%' -Force; Get-ChildItem -LiteralPath '%MPC_TMP%\Mpc-main' -Force | Where-Object { $_.Name -ne 'start_virtualdj_bridge.bat' } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination '%~dp0' -Recurse -Force }; Remove-Item -Force '%MPC_ZIP%' -ErrorAction SilentlyContinue; Remove-Item -Recurse -Force '%MPC_TMP%' -ErrorAction SilentlyContinue"
if errorlevel 1 (
  echo [AUTO-UPDATE] Impossible de joindre GitHub. Demarrage de la version locale.
) else (
  echo [AUTO-UPDATE] MPC Studio est a jour.
)

set "PYEXE="
where py.exe >nul 2>&1
if not errorlevel 1 set "PYEXE=py -3"

if not defined PYEXE if exist "%LocalAppData%\Programs\Python\Python314\python.exe" set "PYEXE=%LocalAppData%\Programs\Python\Python314\python.exe"
if not defined PYEXE if exist "%LocalAppData%\Programs\Python\Python313\python.exe" set "PYEXE=%LocalAppData%\Programs\Python\Python313\python.exe"
if not defined PYEXE if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set "PYEXE=%LocalAppData%\Programs\Python\Python312\python.exe"
if not defined PYEXE if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "PYEXE=%LocalAppData%\Programs\Python\Python311\python.exe"

if not defined PYEXE (
  for /f "delims=" %%P in ('where python.exe 2^>nul') do (
    echo %%P | find /I "WindowsApps" >nul
    if errorlevel 1 if not defined PYEXE set "PYEXE=%%P"
  )
)

if not defined PYEXE (
  echo.
  echo ERREUR : Python 3 est introuvable sur ce PC.
  echo Relance l'installateur MPC Studio avec Python.
  echo.
  pause
  exit /b 1
)

echo.
echo [DEMARRAGE] Lancement du bridge VirtualDJ...
echo.

if "%PYEXE%"=="py -3" (
  py -3 virtualdj_bridge_v2.py
) else (
  "%PYEXE%" virtualdj_bridge_v2.py
)

if not %errorlevel%==0 (
  echo.
  echo Le bridge s'est arrete avec une erreur.
  pause
)
endlocal
