@echo off
rem Encerra o backend e o frontend do Eldoria (somente processos deste projeto).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\eldoria.ps1" -Stop
pause
