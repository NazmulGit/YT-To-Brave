@echo off
REM Wrapper: Chrome can only invoke .exe / .bat directly on Windows.
REM This forwards stdin/stdout to the Python script.
setlocal
set "DIR=%~dp0"
set "PY=%DIR%host.py"

REM Try py launcher first, fall back to python on PATH
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%PY%" %*
  exit /b
)

where python >nul 2>nul
if %errorlevel%==0 (
  python "%PY%" %*
  exit /b
)

REM No Python — write an error so the extension can show a useful message
>&2 echo Python is not installed or not on PATH. Install Python 3.8+ and re-run install.bat.
exit /b 1
