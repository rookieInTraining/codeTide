@echo off
echo Starting CodeTide Demo...
echo.

cd backend
echo Creating sample data...
python sample_data.py

echo.
echo Starting backend server...
echo Backend will be available at http://localhost:5000
echo.
echo To start frontend:
echo   1. Open new terminal
echo   2. cd frontend
echo   3. npm install
echo   4. npm start
echo   5. Open http://localhost:3000
echo.

python app.py
