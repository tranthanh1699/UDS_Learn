#!/usr/bin/env bash
# UDS Lab - khởi động nhanh cho Linux/macOS
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "[LỖI] Chưa cài Node.js. Hãy cài Node.js 20 LTS tại https://nodejs.org (hoặc: nvm install 20)."
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[LỖI] Node.js $(node -v) quá cũ. UDS Lab cần Node.js 20 LTS (gợi ý: nvm install 20 && nvm use 20)."
  exit 1
fi
if [ "$NODE_MAJOR" -ne 20 ]; then
  echo "[CẢNH BÁO] Bạn đang dùng Node.js $(node -v). UDS Lab được kiểm thử trên Node.js 20 LTS; vẫn tiếp tục chạy..."
fi

if [ ! -d node_modules ]; then
  echo "[1/2] Đang cài thư viện (npm install), chỉ cần làm lần đầu..."
  npm install
fi

echo "[2/2] Đang khởi động UDS Lab tại http://localhost:5173 ..."
npm run dev
