@echo off
chcp 65001 >nul
echo Đang khởi động Backend FastAPI Badminton Management...
cd /d "%~dp0"
"C:\Users\ItsMinzCute\AppData\Local\Programs\Python\Python314\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
