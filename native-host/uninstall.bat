@echo off
setlocal
set "HOST_NAME=com.ytbrave.host"

echo Removing native messaging registry keys...
for %%K in (
  "HKCU\Software\Google\Chrome\NativeMessagingHosts\%HOST_NAME%"
  "HKCU\Software\Microsoft\Edge\NativeMessagingHosts\%HOST_NAME%"
  "HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\%HOST_NAME%"
) do (
  reg delete %%K /f >nul 2>nul
  if !errorlevel!==0 (echo [OK] Removed: %%~K) else (echo [SKIP] %%~K)
)

del /q "%~dp0com.ytbrave.host.installed.json" >nul 2>nul

echo Done.
pause
