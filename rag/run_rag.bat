@echo off
TITLE RAG + RL + NDVI Service (Port 8000)
cd /d "%~dp0"
echo Starting RAG + RL + NDVI Service...
call venv\Scripts\activate
uvicorn rag_api:app --host 0.0.0.0 --port 8000 --reload
pause
