# 初始化4条独立的链
# 此脚本在容器启动后，为每个链创建独立的区块链

Write-Host "开始初始化4条独立的链..." -ForegroundColor Green

$chains = @(
    @{Name="mainchain"; ChainName="xuper"; Container="xuperchain-main-node1"; RpcPort=37101},
    @{Name="subchain1"; ChainName="subchain1"; Container="xuperchain-sub1-node1"; RpcPort=37102},
    @{Name="subchain2"; ChainName="subchain2"; Container="xuperchain-sub2-node1"; RpcPort=37103},
    @{Name="subchain3"; ChainName="subchain3"; Container="xuperchain-sub3-node1"; RpcPort=37104}
)

foreach ($chain in $chains) {
    $chainName = $chain.Name
    $bcName = $chain.ChainName
    $container = $chain.Container
    $rpcPort = $chain.RpcPort
    $genesisFile = "data/genesis/$bcName.json"
    
    Write-Host "`n处理链: $bcName (容器: $container)" -ForegroundColor Yellow
    
    # 检查容器是否运行
    $containerRunning = docker ps --format "{{.Names}}" | Select-String -Pattern "^$container$"
    
    if (-not $containerRunning) {
        Write-Host "  警告: 容器 $container 未运行，跳过创建链" -ForegroundColor Red
        continue
    }
    
    # 检查链是否已存在
    Write-Host "  检查链是否已存在..." -ForegroundColor Cyan
    $chainCheck = docker exec $container sh -c "if [ -d data/blockchain/$bcName ]; then echo 'exists'; else echo 'not exists'; fi" 2>&1
    $chainExists = $chainCheck | Select-String -Pattern "exists" | ForEach-Object { $_.Line.Trim() }
    
    if ($chainExists -eq "exists") {
        Write-Host "  链 $bcName 已存在，跳过创建" -ForegroundColor Green
        
        # 验证链状态
        Write-Host "  验证链状态..." -ForegroundColor Cyan
        docker exec $container sh -c "./bin/xchain-cli status -H 127.0.0.1:$rpcPort 2>&1 | grep -A 2 '\"name\"' | head -3" 2>$null
        continue
    }
    
    # 检查创世文件是否存在
    $genesisCheck = docker exec $container sh -c "if [ -f $genesisFile ]; then echo 'exists'; else echo 'not exists'; fi" 2>&1
    $genesisExists = $genesisCheck | Select-String -Pattern "exists" | ForEach-Object { $_.Line.Trim() }
    
    if ($genesisExists -ne "exists") {
        Write-Host "  错误: 创世文件 $genesisFile 不存在" -ForegroundColor Red
        Write-Host "  请先运行 setup-chains.ps1 生成配置文件" -ForegroundColor Yellow
        continue
    }
    
    # 创建链（使用xchain命令，不是xchain-cli）
    Write-Host "  创建链 $bcName..." -ForegroundColor Cyan
    $result = docker exec $container sh -c "cd /home/xchain && ./bin/xchain createChain -n $bcName -g $genesisFile -e conf/env.yaml 2>&1"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  链 $bcName 创建成功！" -ForegroundColor Green
        
        # 验证链状态
        Write-Host "  验证链状态..." -ForegroundColor Cyan
        Start-Sleep -Seconds 2
        docker exec $container sh -c "./bin/xchain-cli status -H 127.0.0.1:$rpcPort 2>&1 | grep -A 2 '\"name\"' | head -3" 2>$null
    } else {
        Write-Host "  链 $bcName 创建失败" -ForegroundColor Red
        Write-Host "  错误信息: $result" -ForegroundColor Red
    }
}

Write-Host "`n所有链初始化完成！" -ForegroundColor Green
Write-Host "`n验证所有链状态:" -ForegroundColor Yellow
foreach ($chain in $chains) {
    $container = $chain.Container
    $bcName = $chain.ChainName
    $rpcPort = $chain.RpcPort
    
    Write-Host "`n  $bcName ($container):" -ForegroundColor Cyan
    $status = docker exec $container sh -c "./bin/xchain-cli status -H 127.0.0.1:$rpcPort 2>&1 | grep -A 2 '\"name\"' | head -3" 2>$null
    if ($status) {
        Write-Host "    $status" -ForegroundColor Green
    } else {
        Write-Host "    无法获取状态" -ForegroundColor Red
    }
}

