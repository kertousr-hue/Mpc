@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>&1 || (echo Python est requis.& pause & exit /b 1)
python -c "import pedalboard, numpy" >nul 2>&1 || (
  echo Installation des dependances VST Bridge...
  python -m pip install pedalboard numpy
)
python vst_bridge.py
pause
