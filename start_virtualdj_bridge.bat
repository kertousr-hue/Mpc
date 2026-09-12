@echo off
setlocal
cd /d "%~dp0"
title MPC Studio - VirtualDJ Bridge

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 virtualdj_bridge.py
  goto :end
)

where python >nul 2>&1
if %errorlevel%==0 (
  python virtualdj_bridge.py
  goto :end
)

echo.
echo Python 3 est introuvable sur ce PC.
echo Installe Python 3 puis relance ce fichier.
echo.
pause

:end
if not %errorlevel%==0 pause
endlocal
