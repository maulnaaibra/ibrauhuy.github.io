@echo off
title ImmersionTrack Background Agent
echo Menjalankan ImmersionTrack Background Agent...
echo Biarkan jendela ini terbuka, atau gunakan start-hidden.vbs untuk berjalan di background.
node "%~dp0tracker-agent.mjs"
pause
