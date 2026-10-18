@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the LTS version from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js LTS and make sure npm is included.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing the required packages...
  call npm install
  if errorlevel 1 (
    echo Package installation failed.
    pause
    exit /b 1
  )
)

start "Bio Portal Server" /D "%~dp0" cmd /k npm start
timeout /t 2 /nobreak >nul
start "" "http://localhost:5000"

endlocal
