<#
.SYNOPSIS
  Sobe o Eldoria (backend NestJS + frontend Next.js) e monitora os dois.

.DESCRIPTION
  1. Encerra instâncias anteriores do próprio projeto nas portas 3001/3000.
  2. Prepara o ambiente: dependências, migrações e cliente Prisma.
  3. Sobe o Ollama local (quando instalado) e confere o modelo do mestre IA.
  4. Inicia backend e frontend com logs por sessão em logs\<data-hora>\.
  5. Monitora a cada -CheckInterval segundos: processo vivo e resposta HTTP
     (backend: /api/health, que também testa o banco; frontend: página inicial).
     Após 3 falhas seguidas, ou se o processo cair, reinicia o serviço.
     Mais de 5 reinícios em 10 minutos: desiste daquele serviço e avisa.

  Teclas durante o monitoramento:
    A = abrir o site   R = reiniciar tudo   L = últimas linhas dos logs   Q = sair

.EXAMPLE
  .\eldoria.ps1                 # desenvolvimento (recarrega ao editar)
  .\eldoria.ps1 -Mode prod      # gera build e roda em modo produção
  .\eldoria.ps1 -PullModel      # baixa o modelo do mestre IA se faltar
  .\eldoria.ps1 -SkipAi         # sobe só backend/frontend
  .\eldoria.ps1 -Stop           # só encerra o que estiver rodando
#>
param(
  [ValidateSet("dev", "prod")]
  [string]$Mode = "dev",
  [int]$CheckInterval = 10,
  [switch]$NoBrowser,
  [switch]$SkipSetup,
  [switch]$PullModel,
  [switch]$SkipAi,
  [switch]$Stop
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$Root = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$SiteUrl = "http://localhost:3000"
$FailuresBeforeRestart = 3
$MaxRestarts = 5
$RestartWindowMinutes = 10
$KeepLogSessions = 10
# "Parar Eldoria" cria este arquivo; o monitor aberto o vê e encerra sozinho,
# em vez de reiniciar os serviços que acabaram de ser parados.
$StopFlag = Join-Path $Root "logs\.parar"
# PID do monitor em execução: impede dois monitores brigando pelos mesmos serviços.
$LockFile = Join-Path $Root "logs\.monitor.pid"
# Ollama local (mestre IA). Só é encerrado no fim se foi este script que o subiu.
$AiUrl = "http://127.0.0.1:11434"
$AiPidFile = Join-Path $Root "logs\.ollama.pid"
$script:AiProcess = $null
$script:AiManaged = $false
$script:AiLabel = "IA: não verificada"

# ---------------------------------------------------------------- utilidades

$script:MonitorLog = $null

function Write-Event {
  param([string]$Message, [string]$Level = "info")
  $time = Get-Date -Format "HH:mm:ss"
  $color = switch ($Level) { "ok" { "Green" } "warn" { "Yellow" } "error" { "Red" } default { "Gray" } }
  Write-Host "[$time] $Message" -ForegroundColor $color
  if ($script:MonitorLog) {
    Add-Content -Path $script:MonitorLog -Value "[$(Get-Date -Format s)] [$Level] $Message" -Encoding UTF8
  }
}

function Set-Title([string]$Text) {
  try { $Host.UI.RawUI.WindowTitle = "Eldoria - $Text" } catch { }
}

function Assert-Command([string]$Name, [string]$Hint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Write-Event "$Name não encontrado. $Hint" "error"
    exit 1
  }
}

function Invoke-Step([string]$Label, [string]$WorkDir, [string]$Command) {
  Write-Event $Label
  Push-Location $WorkDir
  try {
    $output = & cmd.exe /d /c "$Command 2>&1"
    if ($LASTEXITCODE -ne 0) {
      $output | Select-Object -Last 20 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
      throw "Falhou: $Command (código $LASTEXITCODE)"
    }
  } finally {
    Pop-Location
  }
}

# Encerra o processo e todos os filhos (npm -> node -> servidor).
function Stop-Tree([int]$ProcessId) {
  & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null
}

# Encerra apenas processos DESTE projeto escutando na porta: sobe pela árvore
# enquanto o pai ainda for do projeto (npm, nest, next) e mata a partir dali.
function Stop-ProjectOnPort([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $conn) { return $true }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)"
  if (-not $proc -or $proc.CommandLine -notlike "*$Root*") {
    $who = if ($proc) { $proc.Name } else { "desconhecido" }
    Write-Event "A porta $Port está ocupada por outro programa ($who, PID $($conn.OwningProcess)). Feche-o e tente de novo." "error"
    return $false
  }
  $top = $proc
  while ($true) {
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$($top.ParentProcessId)" -ErrorAction SilentlyContinue
    if (-not $parent -or $parent.Name -notin @("node.exe", "cmd.exe")) { break }
    if ($parent.CommandLine -notlike "*$Root*" -and $parent.CommandLine -notmatch "npm|nest|next") { break }
    $top = $parent
  }
  Write-Event "Encerrando instância anterior na porta $Port (PID $($top.ProcessId))." "warn"
  Stop-Tree $top.ProcessId
  for ($i = 0; $i -lt 20; $i++) {
    if (-not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)) { return $true }
    Start-Sleep -Milliseconds 500
  }
  Write-Event "A porta $Port continua ocupada." "error"
  return $false
}

# Servidores DESTE projeto pela assinatura da linha de comando (Nest CLI e
# build do backend, Next do frontend), mesmo sem porta aberta: um "nest start
# --watch" órfão recompila a cada edição e tenta subir outro backend.
function Get-ProjectServers {
  $patterns = @(
    "*$BackendDir\node_modules\*@nestjs\cli\bin\nest.js*",
    "*$BackendDir\dist\src\main*",
    "*$FrontendDir\node_modules\*next\dist\*"
  )
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $cmd = $_.CommandLine
    $cmd -and ($patterns | Where-Object { $cmd -like $_ })
  }
}

function Stop-ProjectServers {
  $servers = @(Get-ProjectServers)
  if ($servers.Count -eq 0) { return }
  Write-Event "Encerrando $($servers.Count) processo(s) de servidor deste projeto que ficaram rodando." "warn"
  foreach ($proc in $servers) { Stop-Tree $proc.ProcessId }
  Start-Sleep -Milliseconds 800
}

# Se outro monitor estiver aberto, pede que ele encerre e espera.
function Stop-OtherMonitor {
  if (-not (Test-Path $LockFile)) { return }
  $otherPid = 0
  [void][int]::TryParse((Get-Content $LockFile -ErrorAction SilentlyContinue | Select-Object -First 1), [ref]$otherPid)
  if ($otherPid -eq 0 -or $otherPid -eq $PID) { return }
  $other = Get-CimInstance Win32_Process -Filter "ProcessId=$otherPid" -ErrorAction SilentlyContinue
  # PID reaproveitado pelo Windows não conta: tem de ser um PowerShell criado
  # antes de o arquivo de trava ser escrito.
  if (-not $other -or $other.Name -notin @("powershell.exe", "pwsh.exe")) { return }
  if ($other.CreationDate -gt (Get-Item $LockFile).LastWriteTime) { return }
  Write-Event "Já existe um monitor aberto (PID $otherPid). Pedindo que ele encerre..." "warn"
  Set-Content -Path $StopFlag -Value (Get-Date -Format s)
  for ($i = 0; $i -lt 40; $i++) {
    if (-not (Get-Process -Id $otherPid -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
  }
  if (Get-Process -Id $otherPid -ErrorAction SilentlyContinue) {
    Write-Event "O outro monitor não encerrou; finalizando-o." "warn"
    Stop-Tree $otherPid
  }
  Remove-Item $StopFlag -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------- mestre IA

function Get-BackendSetting([string]$Name, [string]$Default) {
  $envFile = Join-Path $BackendDir ".env"
  if (-not (Test-Path $envFile)) { return $Default }
  $line = Get-Content -LiteralPath $envFile -Encoding UTF8 -ErrorAction SilentlyContinue |
    Where-Object { $_ -match "^\s*$([regex]::Escape($Name))\s*=" } |
    Select-Object -Last 1
  if (-not $line) { return $Default }
  $value = ($line -split "=", 2)[1].Trim().Trim('"').Trim("'")
  if ($value) { return $value }
  return $Default
}

function Get-OllamaExe {
  $command = Get-Command "ollama" -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  foreach ($candidate in @(
      (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
      (Join-Path $env:ProgramFiles "Ollama\ollama.exe")
    )) {
    if (Test-Path $candidate) { return $candidate }
  }
  return $null
}

function Get-OllamaTags {
  try {
    return Invoke-RestMethod -Uri "$AiUrl/api/tags" -TimeoutSec 3
  } catch {
    return $null
  }
}

function Start-AiService([string]$LogDir) {
  if ($SkipAi) {
    $script:AiLabel = "IA: desligada"
    Write-Event "Mestre IA desligado nesta execução (-SkipAi)." "warn"
    return
  }

  $exe = Get-OllamaExe
  if (-not $exe) {
    $script:AiLabel = "IA: Ollama não instalado"
    Write-Event "Ollama não encontrado. O mestre IA fica indisponível; instale em https://ollama.com e rode de novo." "warn"
    return
  }

  $tags = Get-OllamaTags
  if (-not $tags) {
    $outLog = Join-Path $LogDir "ollama.out.log"
    $errLog = Join-Path $LogDir "ollama.err.log"
    try {
      $script:AiProcess = Start-Process -FilePath $exe -ArgumentList "serve" `
        -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput $outLog -RedirectStandardError $errLog
      [void]$script:AiProcess.Handle
      $script:AiManaged = $true
      Set-Content -Path $AiPidFile -Value $script:AiProcess.Id
      Write-Event "Ollama iniciado (PID $($script:AiProcess.Id)); aguardando em $AiUrl..."
    } catch {
      $script:AiLabel = "IA: Ollama não subiu"
      Write-Event "Não foi possível iniciar o Ollama: $($_.Exception.Message)" "warn"
      return
    }

    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
      $tags = Get-OllamaTags
      if ($tags) { break }
      if ($script:AiProcess.HasExited) { break }
      Start-Sleep -Seconds 1
    }
  } else {
    Write-Event "Ollama já está respondendo em $AiUrl (processo externo)." "info"
    Remove-Item $AiPidFile -Force -ErrorAction SilentlyContinue
  }

  if (-not $tags) {
    $script:AiLabel = "IA: Ollama sem resposta"
    Write-Event "O Ollama não respondeu em $AiUrl. O jogo continua; o mestre IA fica indisponível." "warn"
    return
  }

  $model = Get-BackendSetting "GAME_MASTER_MODEL" "gemma2:9b"
  $names = @($tags.models | ForEach-Object { $_.name } | Where-Object { $_ })
  $found = @($names | Where-Object {
      $_ -eq $model -or $_ -eq "${model}:latest" -or ($_ -replace ':latest$', '') -eq $model
    }).Count -gt 0

  if (-not $found) {
    $script:AiLabel = "IA: modelo ausente"
    Write-Event "O modelo '$model' não está instalado no Ollama." "warn"
    $pull = $PullModel
    if (-not $pull) {
      try {
        $answer = Read-Host "Baixar '$model' agora? Pode levar vários minutos (s/N)"
        $pull = $answer -match '^[sS]'
      } catch {
        $pull = $false
      }
    }
    if ($pull) {
      Write-Event "Baixando o modelo '$model' (acompanhe pelo log $LogDir)..."
      try {
        Invoke-Step "Baixando modelo do mestre IA..." $Root "`"$exe`" pull $model"
        $tags = Get-OllamaTags
        $names = @($tags.models | ForEach-Object { $_.name } | Where-Object { $_ })
        $found = @($names | Where-Object {
            $_ -eq $model -or $_ -eq "${model}:latest" -or ($_ -replace ':latest$', '') -eq $model
          }).Count -gt 0
      } catch {
        Write-Event "Não foi possível baixar o modelo. Rode manualmente: ollama pull $model" "warn"
      }
    } else {
      Write-Event "Para habilitar o mestre IA depois: ollama pull $model" "warn"
    }
  }

  if ($found) {
    $script:AiLabel = "IA: $model"
    Write-Event "Mestre IA pronto (modelo $model)." "ok"
  } elseif (-not $found) {
    $script:AiLabel = "IA: sem modelo"
    Write-Event "Mestre IA fica indisponível até instalar o modelo '$model'." "warn"
  }
}

function Stop-AiService {
  if ($script:AiProcess -and -not $script:AiProcess.HasExited) {
    Stop-Tree $script:AiProcess.Id
  }
  $script:AiProcess = $null

  if (Test-Path $AiPidFile) {
    $saved = Get-Content $AiPidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($saved) {
      $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$saved" -ErrorAction SilentlyContinue
      if ($proc -and $proc.CommandLine -match "ollama") {
        Stop-Tree ([int]$saved)
      }
    }
    Remove-Item $AiPidFile -Force -ErrorAction SilentlyContinue
  }
  $script:AiManaged = $false
}

# ---------------------------------------------------------------- serviços

function New-Service([string]$Name, [string]$WorkDir, [string]$Command, [int]$Port, [string]$HealthUrl, [int]$StartTimeout) {
  [pscustomobject]@{
    Name = $Name; WorkDir = $WorkDir; Command = $Command; Port = $Port
    HealthUrl = $HealthUrl; StartTimeout = $StartTimeout
    Process = $null; Failures = 0; Restarts = @(); State = "parado"; LastMs = $null
    OutLog = $null; ErrLog = $null; GaveUp = $false; Runs = 0
  }
}

function Start-EldoriaService([pscustomobject]$Svc, [string]$LogDir) {
  # Um par de arquivos por execução: um reinício não apaga o log da falha.
  $Svc.Runs++
  $suffix = if ($Svc.Runs -gt 1) { ".$($Svc.Runs)" } else { "" }
  $Svc.OutLog = Join-Path $LogDir "$($Svc.Name)$suffix.out.log"
  $Svc.ErrLog = Join-Path $LogDir "$($Svc.Name)$suffix.err.log"
  $Svc.Process = Start-Process -FilePath "cmd.exe" -ArgumentList "/d /c $($Svc.Command)" `
    -WorkingDirectory $Svc.WorkDir -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $Svc.OutLog -RedirectStandardError $Svc.ErrLog
  # Guardar o handle: sem isso o Windows não preserva o código de saída.
  [void]$Svc.Process.Handle
  $Svc.Failures = 0
  $Svc.State = "iniciando"
  Write-Event "$($Svc.Name): iniciado (PID $($Svc.Process.Id)), aguardando responder em $($Svc.HealthUrl)..."
}

function Stop-EldoriaService([pscustomobject]$Svc) {
  if ($Svc.Process -and -not $Svc.Process.HasExited) { Stop-Tree $Svc.Process.Id }
  $Svc.Process = $null
  $Svc.State = "parado"
}

# Retorna o tempo de resposta em ms, ou $null se não respondeu bem.
function Test-Health([pscustomobject]$Svc) {
  $watch = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $response = Invoke-WebRequest -Uri $Svc.HealthUrl -UseBasicParsing -TimeoutSec 15
    if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) { return [int]$watch.ElapsedMilliseconds }
  } catch { }
  return $null
}

function Wait-Ready([pscustomobject]$Svc) {
  $deadline = (Get-Date).AddSeconds($Svc.StartTimeout)
  while ((Get-Date) -lt $deadline) {
    if ($Svc.Process.HasExited) {
      Write-Event "$($Svc.Name): o processo terminou durante a inicialização." "error"
      Show-LogTail $Svc
      return $false
    }
    $ms = Test-Health $Svc
    if ($null -ne $ms) {
      $Svc.State = "ok"; $Svc.LastMs = $ms
      Write-Event "$($Svc.Name): pronto ($ms ms)." "ok"
      return $true
    }
    Start-Sleep -Seconds 2
  }
  Write-Event "$($Svc.Name): não respondeu em $($Svc.StartTimeout) s." "error"
  Show-LogTail $Svc
  return $false
}

function Show-LogTail([pscustomobject]$Svc, [int]$Lines = 15) {
  foreach ($file in @($Svc.ErrLog, $Svc.OutLog)) {
    if ($file -and (Test-Path $file)) {
      $tail = Get-Content -Path $file -Tail $Lines -Encoding UTF8 -ErrorAction SilentlyContinue | Where-Object { $_.Trim() }
      if ($tail) {
        Write-Host "    --- $(Split-Path $file -Leaf) ---" -ForegroundColor DarkGray
        $tail | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
      }
    }
  }
}

# No Windows (e mais ainda dentro do OneDrive) o "nest start" pode falhar com
# ENOTEMPTY ao apagar dist\ se um arquivo ainda estiver preso. Limpamos antes,
# com algumas tentativas.
function Clear-BuildOutput([string]$Path) {
  for ($i = 1; $i -le 5; $i++) {
    if (-not (Test-Path $Path)) { return }
    try {
      Remove-Item -Path $Path -Recurse -Force -ErrorAction Stop
      return
    } catch {
      Start-Sleep -Milliseconds (400 * $i)
    }
  }
  Write-Event "Não consegui limpar $Path (arquivo em uso). Seguindo assim mesmo." "warn"
}

function Restart-EldoriaService([pscustomobject]$Svc, [string]$LogDir, [string]$Reason) {
  $windowStart = (Get-Date).AddMinutes(-$RestartWindowMinutes)
  $Svc.Restarts = @($Svc.Restarts | Where-Object { $_ -gt $windowStart })
  if ($Svc.Restarts.Count -ge $MaxRestarts) {
    $Svc.GaveUp = $true; $Svc.State = "falhou"
    Write-Event "$($Svc.Name): $MaxRestarts reinícios em $RestartWindowMinutes min. Parei de tentar; veja $($Svc.ErrLog). Tecle R para tentar de novo." "error"
    [Console]::Beep(440, 300)
    return
  }
  Write-Event "$($Svc.Name): reiniciando ($Reason)." "warn"
  Show-LogTail $Svc 10
  Stop-EldoriaService $Svc
  [void](Stop-ProjectOnPort $Svc.Port)
  $Svc.Restarts += Get-Date
  if ($Svc.Name -eq "backend" -and $Mode -eq "dev") { Clear-BuildOutput (Join-Path $BackendDir "dist") }
  Start-EldoriaService $Svc $LogDir
  [void](Wait-Ready $Svc)
}

function Update-Title($Services) {
  $parts = $Services | ForEach-Object {
    if ($_.State -eq "ok") { "$($_.Name) ok $($_.LastMs)ms" } else { "$($_.Name) $($_.State)" }
  }
  if ($script:AiLabel) { $parts += $script:AiLabel }
  Set-Title ($parts -join " | ")
}

# ---------------------------------------------------------------- execução

Set-Location $Root
Write-Host ""
Write-Host "  Eldoria - mesa de RPG" -ForegroundColor Yellow
Write-Host "  modo: $Mode    pasta: $Root" -ForegroundColor DarkGray
Write-Host ""

Assert-Command "node" "Instale o Node.js 20 ou mais recente: https://nodejs.org"
Assert-Command "npm" "Instale o Node.js (o npm vem junto)."

if ($Stop) {
  New-Item -ItemType Directory -Force -Path (Split-Path $StopFlag) | Out-Null
  Set-Content -Path $StopFlag -Value (Get-Date -Format s)
  # Dá ao monitor aberto a chance de encerrar os serviços ele mesmo.
  Start-Sleep -Seconds ([Math]::Min(12, $CheckInterval + 2))
}
New-Item -ItemType Directory -Force -Path (Join-Path $Root "logs") | Out-Null
if (-not $Stop) { Stop-OtherMonitor }
$okBackend = Stop-ProjectOnPort 3001
$okFrontend = Stop-ProjectOnPort 3000
Stop-ProjectServers
Stop-AiService
if ($Stop) {
  Remove-Item $StopFlag -Force -ErrorAction SilentlyContinue
  if ($okBackend -and $okFrontend) { Write-Event "Nada mais rodando nas portas 3000 e 3001." "ok" }
  exit 0
}
Remove-Item $StopFlag -Force -ErrorAction SilentlyContinue
Set-Content -Path $LockFile -Value $PID
if (-not ($okBackend -and $okFrontend)) { exit 1 }

$session = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$logsRoot = Join-Path $Root "logs"
$logDir = Join-Path $logsRoot $session
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$script:MonitorLog = Join-Path $logDir "monitor.log"
Get-ChildItem $logsRoot -Directory | Sort-Object Name -Descending | Select-Object -Skip $KeepLogSessions |
  ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }

try {
  if (-not $SkipSetup) {
    if (-not (Test-Path (Join-Path $BackendDir "node_modules"))) { Invoke-Step "Instalando dependências do backend..." $BackendDir "npm install" }
    if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) { Invoke-Step "Instalando dependências do frontend..." $FrontendDir "npm install" }
    if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
      Write-Event "backend\.env não existe. Crie-o com DATABASE_URL, JWT_SECRET e PORT=3001." "error"
      exit 1
    }
    Invoke-Step "Aplicando migrações do banco..." $BackendDir "npx prisma migrate deploy"
    Invoke-Step "Gerando cliente Prisma..." $BackendDir "npx prisma generate"
    # Cópias temporárias do motor do Prisma (~20 MB cada) que sobram quando o
    # arquivo está em uso por outro processo.
    Get-ChildItem (Join-Path $BackendDir "node_modules\.prisma\client") -Filter "query_engine-*.tmp*" -ErrorAction SilentlyContinue |
      Remove-Item -Force -ErrorAction SilentlyContinue
    if ($Mode -eq "prod") {
      Invoke-Step "Compilando backend..." $BackendDir "npm run build"
      Invoke-Step "Compilando frontend (pode levar alguns minutos)..." $FrontendDir "npm run build"
    }
  }
} catch {
  Write-Event $_.Exception.Message "error"
  exit 1
}

Start-AiService $logDir

if ($Mode -eq "prod") {
  $backend = New-Service "backend" $BackendDir "node dist\src\main.js" 3001 "http://localhost:3001/api/health" 60
  $frontend = New-Service "frontend" $FrontendDir "npm run start" 3000 $SiteUrl 60
} else {
  $backend = New-Service "backend" $BackendDir "npm run start:dev" 3001 "http://localhost:3001/api/health" 120
  $frontend = New-Service "frontend" $FrontendDir "npm run dev" 3000 $SiteUrl 180
}
$services = @($backend, $frontend)

try {
  if ($Mode -eq "dev") { Clear-BuildOutput (Join-Path $BackendDir "dist") }
  foreach ($svc in $services) {
    Start-EldoriaService $svc $logDir
    $ready = Wait-Ready $svc
    if (-not $ready) {
      # Uma segunda tentativa cobre falhas passageiras (arquivo preso, porta lenta).
      Write-Event "$($svc.Name): tentando subir de novo..." "warn"
      Stop-EldoriaService $svc
      [void](Stop-ProjectOnPort $svc.Port)
      if ($svc.Name -eq "backend" -and $Mode -eq "dev") { Clear-BuildOutput (Join-Path $BackendDir "dist") }
      Start-Sleep -Seconds 2
      Start-EldoriaService $svc $logDir
      $ready = Wait-Ready $svc
    }
    if (-not $ready) {
      Write-Event "Não foi possível subir o $($svc.Name). Logs em $logDir" "error"
      exit 1
    }
  }
  Update-Title $services
  Write-Event "Eldoria no ar: $SiteUrl  (logs em $logDir)" "ok"
  if (-not $NoBrowser) { Start-Process $SiteUrl }
  Write-Host ""
  Write-Host "  Monitorando a cada $CheckInterval s.  [A] abrir site  [R] reiniciar  [L] logs  [Q] sair" -ForegroundColor Cyan
  Write-Host ""

  # Sem console interativo (ex.: saída redirecionada), as teclas ficam desligadas.
  $interactive = $true
  try { [void][Console]::KeyAvailable; [Console]::TreatControlCAsInput = $true } catch { $interactive = $false }
  $lastSummary = Get-Date
  while ($true) {
    # Espera o intervalo atendendo teclas.
    $until = (Get-Date).AddSeconds($CheckInterval)
    $quit = $false
    while ((Get-Date) -lt $until) {
      if ($interactive -and [Console]::KeyAvailable) {
        $key = [Console]::ReadKey($true)
        $isCtrlC = ($key.Modifiers -band [ConsoleModifiers]::Control) -and $key.Key -eq "C"
        switch ($key.Key) {
          "Q" { $quit = $true }
          "A" { Start-Process $SiteUrl }
          "L" { foreach ($svc in $services) { Write-Host "  [$($svc.Name)]" -ForegroundColor Cyan; Show-LogTail $svc 20 } }
          "R" {
            if (-not $SkipAi -and (-not $script:AiProcess -or $script:AiProcess.HasExited)) {
              Start-AiService $logDir
            }
            foreach ($svc in $services) { $svc.GaveUp = $false; $svc.Restarts = @(); Restart-EldoriaService $svc $logDir "pedido manual" }
          }
        }
        if ($isCtrlC) { $quit = $true }
        if ($quit) { break }
      }
      if (Test-Path $StopFlag) {
        Write-Event "Pedido de parada recebido (Parar Eldoria)." "warn"
        $quit = $true
        break
      }
      Start-Sleep -Milliseconds 200
    }
    if ($quit) { break }

    foreach ($svc in $services) {
      if ($svc.GaveUp) { continue }
      if ($svc.Process.HasExited) {
        $code = $svc.Process.ExitCode
        $reason = if ($null -ne $code) { "o processo terminou com código $code" } else { "o processo terminou" }
        Restart-EldoriaService $svc $logDir $reason
        continue
      }
      $ms = Test-Health $svc
      if ($null -ne $ms) {
        if ($svc.State -ne "ok") { Write-Event "$($svc.Name): voltou a responder ($ms ms)." "ok" }
        $svc.State = "ok"; $svc.Failures = 0; $svc.LastMs = $ms
      } else {
        $svc.Failures++
        $svc.State = "sem resposta"
        Write-Event "$($svc.Name): sem resposta ($($svc.Failures)/$FailuresBeforeRestart)." "warn"
        if ($svc.Failures -ge $FailuresBeforeRestart) { Restart-EldoriaService $svc $logDir "$FailuresBeforeRestart verificações sem resposta" }
      }
    }
    if (-not $SkipAi -and $script:AiManaged -and $script:AiProcess -and $script:AiProcess.HasExited) {
      Write-Event "Ollama parou. Use R para reiniciar o mestre IA ou abra o Ollama manualmente." "warn"
      $script:AiManaged = $false
    }
    Update-Title $services

    if (((Get-Date) - $lastSummary).TotalMinutes -ge 5) {
      $lastSummary = Get-Date
      $summary = ($services | ForEach-Object { "$($_.Name): $($_.State)$(if ($_.LastMs) { " ($($_.LastMs) ms)" })" }) -join " | "
      Write-Event "Resumo - $summary"
    }
  }
} finally {
  try { [Console]::TreatControlCAsInput = $false } catch { }
  Write-Event "Encerrando..." "warn"
  foreach ($svc in $services) { Stop-EldoriaService $svc }
  [void](Stop-ProjectOnPort 3001)
  [void](Stop-ProjectOnPort 3000)
  Stop-ProjectServers
  Stop-AiService
  if ((Get-Content $LockFile -ErrorAction SilentlyContinue | Select-Object -First 1) -eq "$PID") {
    Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
  }
  Set-Title "parado"
  Write-Event "Eldoria encerrado. Logs desta sessão: $logDir" "ok"
}
