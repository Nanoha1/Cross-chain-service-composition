# 启动多节点集群脚本

Write-Host "启动多节点XuperChain集群..." -ForegroundColor Green

# 检查Docker是否运行
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: Docker未运行，请先启动Docker Desktop" -ForegroundColor Red
    exit 1
}

# 检查配置文件是否存在
if (-not (Test-Path "docker-compose.yml")) {
    Write-Host "错误: docker-compose.yml不存在" -ForegroundColor Red
    exit 1
}

# 检查节点是否就绪的函数
function Wait-NodeReady {
    param(
        [string]$ContainerName,
        [int]$RpcPort,
        [int]$MaxWaitSeconds = 60,
        [int]$CheckInterval = 2
    )
    
    Write-Host "等待节点 $ContainerName 就绪..." -ForegroundColor Yellow
    $elapsed = 0
    
    while ($elapsed -lt $MaxWaitSeconds) {
        # 检查容器是否运行
        $result = docker ps --filter "name=$ContainerName" --format "{{.Status}}" 2>&1
        if ($LASTEXITCODE -ne 0 -or -not $result -or $result -notmatch "Up") {
            Start-Sleep -Seconds $CheckInterval
            $elapsed += $CheckInterval
            continue
        }
        
        # 检查RPC服务是否响应
        $statusOutput = docker exec $ContainerName ./bin/xchain-cli status -H 127.0.0.1:$RpcPort 2>&1 | Out-String
        if ($LASTEXITCODE -eq 0 -and $statusOutput) {
            $statusJson = $statusOutput | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($statusJson -and $statusJson.blockchains -and $statusJson.blockchains.Count -gt 0) {
                Write-Host "节点 $ContainerName 已就绪" -ForegroundColor Green
                return $true
            }
        }
        
        Start-Sleep -Seconds $CheckInterval
        $elapsed += $CheckInterval
        Write-Host "." -NoNewline -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "警告: 节点 $ContainerName 在 $MaxWaitSeconds 秒内未就绪" -ForegroundColor Yellow
    return $false
}

# 停止现有容器
Write-Host "`n停止现有容器..." -ForegroundColor Yellow
docker-compose -f docker-compose-multinode.yml down 2>&1 | Out-Null

# 构建镜像（如果需要）
Write-Host "`n检查并构建Docker镜像..." -ForegroundColor Yellow
docker-compose -f docker-compose-multinode.yml build

# 阶段1: 启动所有链的node1节点
Write-Host "`n阶段1: 启动所有链的node1节点..." -ForegroundColor Cyan
docker-compose -f docker-compose-multinode.yml up -d main-node1 sub1-node1 sub2-node1 sub3-node1

# 等待所有node1节点就绪
Write-Host "`n等待node1节点就绪..." -ForegroundColor Yellow
$node1Configs = @(
    @{ Container = "xuperchain-main-node1"; Port = 37101 },
    @{ Container = "xuperchain-sub1-node1"; Port = 37102 },
    @{ Container = "xuperchain-sub2-node1"; Port = 37103 },
    @{ Container = "xuperchain-sub3-node1"; Port = 37104 }
)

$allNode1Ready = $true
foreach ($config in $node1Configs) {
    $ready = Wait-NodeReady -ContainerName $config.Container -RpcPort $config.Port
    if (-not $ready) {
        $allNode1Ready = $false
    }
}

if (-not $allNode1Ready) {
    Write-Host "警告: 部分node1节点可能未完全就绪，但将继续启动其他节点" -ForegroundColor Yellow
}

# 阶段2: 启动所有链的node2节点
Write-Host "`n阶段2: 启动所有链的node2节点..." -ForegroundColor Cyan
docker-compose -f docker-compose-multinode.yml up -d main-node2 sub1-node2 sub2-node2 sub3-node2

# 等待node2节点就绪
Write-Host "`n等待node2节点就绪..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 阶段3: 启动所有链的node3节点
Write-Host "`n阶段3: 启动所有链的node3节点..." -ForegroundColor Cyan
docker-compose -f docker-compose-multinode.yml up -d main-node3 sub1-node3 sub2-node3 sub3-node3

# 等待所有节点启动
Write-Host "`n等待所有节点启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 阶段4: 启动前端服务
Write-Host "`n阶段4: 启动前端服务..." -ForegroundColor Cyan
docker-compose -f docker-compose-multinode.yml up -d frontend

# 等待前端启动
Write-Host "`n等待前端服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# 检查容器状态
Write-Host "`n检查容器状态..." -ForegroundColor Cyan
docker-compose -f docker-compose-multinode.yml ps

Write-Host "`n多节点集群启动完成！" -ForegroundColor Green
Write-Host "查看日志: docker-compose -f docker-compose-multinode.yml logs -f" -ForegroundColor Cyan
Write-Host "停止集群: docker-compose -f docker-compose-multinode.yml down" -ForegroundColor Cyan
