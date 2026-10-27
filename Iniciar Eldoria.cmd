@echo off
rem Sobe o Eldoria (backend + frontend) e monitora. Feche com Q nesta janela.
rem Modo producao: "Iniciar Eldoria.cmd" -Mode prod
title Eldoria
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\eldoria.ps1" %*
if errorlevel 1 (
  echo.
  echo O Eldoria parou com erro. Veja as mensagens acima e a pasta logs.
  pause
)
