@echo off
rem Sobe o Eldoria (backend + frontend + Ollama) e monitora. Feche com Q nesta janela.
rem Modo producao: "Iniciar Eldoria.cmd" -Mode prod
rem Baixar modelo do mestre IA: "Iniciar Eldoria.cmd" -PullModel
rem Sem IA: "Iniciar Eldoria.cmd" -SkipAi
title Eldoria
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\eldoria.ps1" %*
if errorlevel 1 (
  echo.
  echo O Eldoria parou com erro. Veja as mensagens acima e a pasta logs.
  pause
)
