@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Install dependencies first using the commands in PLAY-WITH-FRIENDS.md.
  pause
  exit /b 1
)
call npm run friends
pause
