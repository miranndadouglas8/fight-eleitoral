@echo off
title FIGHT ELEITORAL
cd /d "%~dp0"
where node >nul 2>nul || (
  echo.
  echo  O Node.js nao esta instalado.
  echo  Baixe a versao LTS em https://nodejs.org , instale e rode este arquivo de novo.
  echo.
  pause
  exit /b
)
start "" "http://localhost:3000/?semdemo"
node server.js
pause
