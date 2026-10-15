@echo off
chcp 65001 >nul
setlocal
REM UDS Lab - khoi dong nhanh cho Windows
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [LỖI] Chưa cài Node.js. Hãy cài Node.js 20 LTS tại https://nodejs.org
  pause
  exit /b 1
)

for /f %%v in ('node -p "parseInt(process.versions.node)"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo [LỖI] Node.js quá cũ. UDS Lab cần Node.js 20 LTS.
  node -v
  pause
  exit /b 1
)
if not "%NODE_MAJOR%"=="20" (
  echo [CẢNH BÁO] UDS Lab được kiểm thử trên Node.js 20 LTS; vẫn tiếp tục chạy...
)

if not exist node_modules (
  echo [1/2] Đang cài thư viện ^(npm install^), chỉ cần làm lần đầu...
  call npm install
  if errorlevel 1 (
    echo [LỖI] npm install thất bại. Xem thông báo lỗi phía trên.
    pause
    exit /b 1
  )
)

echo [2/2] Đang khởi động UDS Lab tại http://localhost:5173 ...
call npm run dev
