@echo off
rem Encerra backend, frontend e o Ollama iniciado pelo Eldoria (somente processos deste projeto).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\eldoria.ps1" -Stop
pause
