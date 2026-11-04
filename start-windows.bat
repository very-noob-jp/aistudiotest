@echo off
chcp 65001 >nul
title PiFi Enterprise Router - Windows Edition

echo ========================================================
echo   PiFi Enterprise Router - Windows Native Launcher
echo ========================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [✓] 管理者権限 (Administrator): 検出されました
    echo     ポートプロキシ (netsh) や HostedNetwork の操作が利用可能です。
) else (
    echo [!] 警告: 管理者権限なしで実行されています
    echo     Webコンソールや監視機能は動きますが、netsh によるポート転送や
    echo     ホットスポット設定を行う場合は「管理者として実行」を推奨します。
)
echo.

:: Check Node.js
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [X] エラー: Node.js が見つかりません。
    echo     https://nodejs.org/ から Node.js (v18以降) をインストールしてください。
    pause
    exit /b 1
)

:: Display Node.js version
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [✓] Node.js 検出: %NODE_VER%

:: Check node_modules
if not exist "node_modules" (
    echo.
    echo [*] 依存パッケージが見つかりません。npm install を実行します...
    call npm install
    if %errorLevel% neq 0 (
        echo [X] npm install に失敗しました。
        pause
        exit /b 1
    )
)

echo.
echo ========================================================
echo   サーバーを起動しています (ポート 3000)...
echo   ブラウザで以下のURLを開いてください:
echo   http://localhost:3000
echo   管理者アカウント: admin / admin
echo ========================================================
echo.

call npm run dev
pause
