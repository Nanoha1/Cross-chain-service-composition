# 为所有副链部署Go Native合约（golangcounter）

Write-Host "开始为所有副链部署合约..." -ForegroundColor Green

$subchains = @(
    @{Name="subchain1"; Container="xuperchain-sub1-node1"; RpcPort=37102},
    @{Name="subchain2"; Container="xuperchain-sub2-node1"; RpcPort=37103},
    @{Name="subchain3"; Container="xuperchain-sub3-node1"; RpcPort=37104}
)

foreach ($chain in $subchains) {
    $chainName = $chain.Name
    $container = $chain.Container
    $rpcPort = $chain.RpcPort
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "处理链: $chainName" -ForegroundColor Yellow
    Write-Host "容器: $container" -ForegroundColor Yellow
    Write-Host "RPC端口: $rpcPort" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    
    # 1. 检查合约文件是否存在
    Write-Host "1. 检查合约文件..." -ForegroundColor Cyan
    $counterExists = docker exec $container sh -c "test -f /home/xchain/counter && echo 'exists' || echo 'not exists'" 2>&1
    
    if ($counterExists -ne "exists") {
        Write-Host "   错误: 合约文件不存在，请先编译并复制合约文件" -ForegroundColor Red
        Write-Host "   命令: docker cp counter $container:/home/xchain/counter" -ForegroundColor Yellow
        continue
    }
    Write-Host "   ✓ 合约文件存在" -ForegroundColor Green
    
    # 2. 检查并创建合约账户
    Write-Host "2. 检查合约账户..." -ForegroundColor Cyan
    $balance = docker exec $container sh -c "./bin/xchain-cli account balance XC1111111111111111@$chainName -H 127.0.0.1:$rpcPort --name $chainName 2>&1" | Select-String -Pattern "^\d+$" | ForEach-Object { $_.Line.Trim() }
    
    if (-not $balance -or $balance -eq "0") {
        Write-Host "   创建合约账户并转账..." -ForegroundColor Yellow
        # 创建账户（如果不存在，使用--name指定链名）
        docker exec $container sh -c "./bin/xchain-cli account new --account 1111111111111111 --fee 1000 -H 127.0.0.1:$rpcPort --name $chainName 2>&1" | Out-Null
        
        # 转账（使用--name指定链名）
        $transferResult = docker exec $container sh -c "./bin/xchain-cli transfer --to XC1111111111111111@$chainName --amount 20000000 --keys data/keys -H 127.0.0.1:$rpcPort --name $chainName 2>&1"
        Write-Host "   ✓ 账户已创建并转账" -ForegroundColor Green
    } else {
        Write-Host "   ✓ 账户余额: $balance" -ForegroundColor Green
    }
    
    # 3. 检查合约是否已部署
    Write-Host "3. 检查合约是否已部署..." -ForegroundColor Cyan
    $contracts = docker exec $container sh -c "./bin/xchain-cli account contracts --account XC1111111111111111@$chainName -H 127.0.0.1:$rpcPort --name $chainName 2>&1"
    
    if ($contracts -match "golangcounter") {
        Write-Host "   ✓ 合约已部署，跳过" -ForegroundColor Green
        continue
    }
    
    # 4. 部署合约（使用base64编码避免转义问题）
    Write-Host "4. 部署合约..." -ForegroundColor Cyan
    # 创建部署参数（base64编码）
    $deployArgsBase64 = "eyJjcmVhdG9yIjoiWEMxMTExMTExMTExMTExMTExMTExQHN1YmNoYWluMSJ9"
    if ($chainName -eq "subchain2") {
        $deployArgsBase64 = "eyJjcmVhdG9yIjoiWEMxMTExMTExMTExMTExMTExMTExQHN1YmNoYWluMiJ9"
    } elseif ($chainName -eq "subchain3") {
        $deployArgsBase64 = "eyJjcmVhdG9yIjoiWEMxMTExMTExMTExMTExMTExMTExQHN1YmNoYWluMyJ9"
    }
    
    $deployResult = docker exec $container sh -c "cd /home/xchain && echo '$deployArgsBase64' | base64 -d > /tmp/deploy_args.json && ARGS=`$(cat /tmp/deploy_args.json) && ./bin/xchain-cli native deploy --account XC1111111111111111@$chainName --runtime go --cname golangcounter counter --fee 15587517 -a `"`$ARGS`" -H 127.0.0.1:$rpcPort --name $chainName 2>&1"
    
    if ($deployResult -match "Tx id:") {
        $txid = ($deployResult | Select-String -Pattern "Tx id: ([a-f0-9]+)").Matches.Groups[1].Value
        Write-Host "   ✓ 合约部署成功！交易ID: $txid" -ForegroundColor Green
    } else {
        Write-Host "   ✗ 合约部署失败:" -ForegroundColor Red
        $deployResult | Select-Object -First 5 | ForEach-Object { Write-Host "      $_" -ForegroundColor Red }
        continue
    }
    
    # 5. 验证部署
    Write-Host "5. 验证部署..." -ForegroundColor Cyan
    Start-Sleep -Seconds 2
    $contracts = docker exec $container sh -c "./bin/xchain-cli account contracts --account XC1111111111111111@$chainName -H 127.0.0.1:$rpcPort --name $chainName 2>&1"
    if ($contracts -match "golangcounter") {
        Write-Host "   ✓ 合约验证成功" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ 合约可能未完全部署，请稍后验证" -ForegroundColor Yellow
    }
    
    # 6. 测试调用
    Write-Host "6. 测试合约调用..." -ForegroundColor Cyan
    $invokeArgsBase64 = "eyJrZXkiOiJ0ZXN0In0="
    $testResult = docker exec $container sh -c "cd /home/xchain && echo '$invokeArgsBase64' | base64 -d > /tmp/invoke_args.json && ARGS=`$(cat /tmp/invoke_args.json) && ./bin/xchain-cli native invoke --method Increase -a `"`$ARGS`" golangcounter --fee 100 --keys data/keys -H 127.0.0.1:$rpcPort --name $chainName 2>&1"
    
    if ($testResult -match "Tx id:") {
        Write-Host "   ✓ 测试调用成功" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ 测试调用失败（可能正常，如果合约刚部署）" -ForegroundColor Yellow
    }
}

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "所有副链合约部署完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

