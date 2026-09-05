@echo off
title Restaurant Tracker Server
cd /d "%~dp0"
echo ========================================================
echo   Starting Restaurant Tracker Multi-Device POS...
echo ========================================================
node server.js
pause
