@echo off
TITLE Soil Classifier API (Port 8002)
cd /d "%~dp0"
echo Starting Soil Classification Service...
call myenv\Scripts\activate
uvicorn soil_service:app --host 0.0.0.0 --port 8002 --reload
pause
