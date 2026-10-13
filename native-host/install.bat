@echo off
REM ================================================================
REM   YT-to-Brave native host installer (Windows).
REM   Default behavior: shows a menu (Auto / Manual / Quit).
REM   Run with /auto or /manual to skip the menu.
REM ================================================================
setlocal EnableDelayedExpansion

set "DIR=%~dp0"
if "%DIR:~-1%"=="\" set "DIR=%DIR:~0,-1%"

REM ---- 1. Find Python ----
where py >nul 2>nul
if %errorlevel%==0 (
  set "PY=py -3"
  goto :have_py
)
where python >nul 2>nul
if %errorlevel%==0 (
  set "PY=python"
  goto :have_py
)

REM ---- 1a. Python missing - try winget ----
echo.
echo  YT-to-Brave installer
echo  =====================
echo.
echo  [!] Python 3.8+ is required but not on PATH.
echo.
where winget >nul 2>nul
if %errorlevel%==0 (
  echo  Found winget. Installing Python 3.12 automatically...
  echo  ^(this may take a minute^)
  echo.
  winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements --silent
  if !errorlevel!==0 (
    echo.
    echo  [OK] Python installed.
    echo  Please CLOSE this window and double-click install.bat again.
    echo  ^(Windows needs to refresh the PATH variable.^)
    echo.
    pause
    exit /b 0
  ) else (
    echo  [!] winget install failed. Use the manual route below.
    echo.
  )
)
echo  Manual install:
echo    1. Visit https://www.python.org/downloads/
echo    2. Run the installer
echo    3. CHECK the box "Add Python to PATH"
echo    4. Re-run this installer
echo.
pause
exit /b 1

:have_py
REM Forward all script args (e.g. /auto, /manual, --id ...) to the Python installer.
%PY% "%DIR%\install.py" %*
exit /b %errorlevel%
