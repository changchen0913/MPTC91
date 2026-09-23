@echo off
cd /d "%~dp0"
title 91 週年紀念禮盒 - 伺服器執行中（關閉此視窗即停止）
echo.
echo    網址： http://127.0.0.1:4173/
echo.
echo    關閉這個視窗，或按 Ctrl+C，即可停止伺服器。
echo.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process 'http://127.0.0.1:4173/'"
node server.cjs
echo.
echo    伺服器已停止。若是剛啟動就結束，通常是連接埠 4173 已被其他程式占用。
pause