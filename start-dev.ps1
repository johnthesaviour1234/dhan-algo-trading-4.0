# Start Development Servers

Write-Host "Starting Algorithmic Trading Platform..." -ForegroundColor Green
Write-Host ""

# Start backend server in new window
Write-Host "Starting Backend Server (Port 3001)..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd 'E:\warp projects\dhan algo trading 3.0\backend'; npm run dev"

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend server in new window
Write-Host "Starting Frontend Server (Port 5173)..." -ForegroundColor Cyan
Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd 'E:\warp projects\dhan algo trading 3.0\frontend'; npm run dev"

Write-Host ""
Write-Host "Servers are starting..." -ForegroundColor Green
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
