@echo off
echo Starting OneDrive Space Analyzer...

:: Check if Python is available
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Python is not installed or not in the PATH. Please install Python 3.7+
    pause
    exit /b 1
)

:: Check if the virtual environment exists
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
    echo Installing required packages...
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo Failed to install dependencies. Please check the requirements.txt file.
        pause
        exit /b 1
    )
) else (
    call venv\Scripts\activate.bat
)

:: Run the application
echo Starting the OneDrive Analyzer...
python app.py

pause