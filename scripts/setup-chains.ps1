# 创建XuperChain多节点配置脚本

$chains = @(
    @{Name="mainchain"; ChainName="xuper"},
    @{Name="subchain1"; ChainName="subchain1"},
    @{Name="subchain2"; ChainName="subchain2"},
    @{Name="subchain3"; ChainName="subchain3"}
)

# 每个链的节点端口配置
$nodePorts = @{
    "mainchain" = @{
        node1 = @{Rpc=37101; P2p=47101; Gw=37301}
        node2 = @{Rpc=37111; P2p=47111; Gw=37311}
        node3 = @{Rpc=37121; P2p=47121; Gw=37321}
    }
    "subchain1" = @{
        node1 = @{Rpc=37102; P2p=47102; Gw=37302}
        node2 = @{Rpc=37112; P2p=47112; Gw=37312}
        node3 = @{Rpc=37122; P2p=47122; Gw=37322}
    }
    "subchain2" = @{
        node1 = @{Rpc=37103; P2p=47103; Gw=37303}
        node2 = @{Rpc=37113; P2p=47113; Gw=37313}
        node3 = @{Rpc=37123; P2p=47123; Gw=37323}
    }
    "subchain3" = @{
        node1 = @{Rpc=37104; P2p=47104; Gw=37304}
        node2 = @{Rpc=37114; P2p=47114; Gw=37314}
        node3 = @{Rpc=37124; P2p=47124; Gw=37324}
    }
}

# 存储每个节点的P2P地址
$nodeAddresses = @{}

Write-Host "开始创建多节点配置..." -ForegroundColor Green

foreach ($chain in $chains) {
    $chainName = $chain.Name
    $chainDir = "chains\$chainName"
    $ports = $nodePorts[$chainName]
    $chainAddresses = @{}
    
    Write-Host "`n处理链: $chainName" -ForegroundColor Yellow
    
    # 第一步：为每个节点创建目录和基础配置
    for ($i = 1; $i -le 3; $i++) {
        $nodeName = "node$i"
        $nodeDir = "$chainDir\$nodeName"
        $confDir = "$nodeDir\conf"
        $dataDir = "$nodeDir\data"
        $logsDir = "$nodeDir\logs"
        $tmpDir = "$nodeDir\tmp"
        
        $nodePort = $ports[$nodeName]
        
        # 创建目录
        New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
        New-Item -ItemType Directory -Force -Path $confDir | Out-Null
        New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
        New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
        New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
        New-Item -ItemType Directory -Force -Path "$dataDir\genesis" | Out-Null
        New-Item -ItemType Directory -Force -Path "$dataDir\keys" | Out-Null
        New-Item -ItemType Directory -Force -Path "$dataDir\netkeys" | Out-Null
        
        # 复制配置文件
        Copy-Item -Path "xuperchain\conf\*" -Destination $confDir -Recurse -Force
        
        # 更新server.yaml
        $serverYaml = Get-Content "$confDir\server.yaml" -Raw
        $serverYaml = $serverYaml -replace "rpcPort: \d+", "rpcPort: $($nodePort.Rpc)"
        $serverYaml = $serverYaml -replace "GWPort: \d+", "GWPort: $($nodePort.Gw)"
        $metricPort = $nodePort.Rpc + 100
        $serverYaml = $serverYaml -replace "metricPort: \d+", "metricPort: $metricPort"
        Set-Content -Path "$confDir\server.yaml" -Value $serverYaml
        
        # 更新network.yaml
        $networkYaml = Get-Content "$confDir\network.yaml" -Raw
        $networkYaml = $networkYaml -replace "/ip4/127\.0\.0\.1/tcp/\d+", "/ip4/0.0.0.0/tcp/$($nodePort.P2p)"
        $networkYaml = $networkYaml -replace "/ip4/0\.0\.0\.0/tcp/\d+", "/ip4/0.0.0.0/tcp/$($nodePort.P2p)"
        Set-Content -Path "$confDir\network.yaml" -Value $networkYaml
        
        # 更新engine.yaml - 主链作为rootChain
        if ($chainName -eq "mainchain") {
            $engineYaml = Get-Content "$confDir\engine.yaml" -Raw
            $engineYaml = $engineYaml -replace "rootChain: .+", "rootChain: $($chain.ChainName)"
            Set-Content -Path "$confDir\engine.yaml" -Value $engineYaml
        }
        
        Write-Host "  创建节点: $nodeName (RPC: $($nodePort.Rpc), P2P: $($nodePort.P2p))"
    }
    
    # 第二步：生成网络密钥（需要Docker镜像）
    Write-Host "  生成网络密钥..." -ForegroundColor Cyan
    for ($i = 1; $i -le 3; $i++) {
        $nodeName = "node$i"
        $nodeDir = "$chainDir\$nodeName"
        $dataDir = "$nodeDir\data"
        
        # 检查是否已有镜像
        $imageName = "spchain-main-node1"
        $imageExists = docker images -q $imageName 2>$null
        
        if (-not $imageExists) {
            Write-Host "    警告: Docker镜像不存在，将使用临时容器生成密钥" -ForegroundColor Yellow
            # 使用临时容器生成密钥
            $absDataDir = (Resolve-Path $dataDir -ErrorAction SilentlyContinue).Path
            if (-not $absDataDir) {
                $absDataDir = Join-Path (Get-Location) $dataDir
            }
            $null = docker run --rm -v "${absDataDir}:/data" -w /data xuperchain/xuperchain:latest /bin/bash -c "cd /home/xchain; ./bin/xchain-cli netURL gen --path /data/netkeys/" 2>&1
        } else {
            # 使用已构建的镜像
            $absDataDir = (Resolve-Path $dataDir -ErrorAction SilentlyContinue).Path
            if (-not $absDataDir) {
                $absDataDir = Join-Path (Get-Location) $dataDir
            }
            $null = docker run --rm -v "${absDataDir}:/data" $imageName /home/xchain/bin/xchain-cli netURL gen --path /data/netkeys/ 2>&1
        }
        
        # 如果生成失败，复制默认密钥
        if (-not (Test-Path "$dataDir\netkeys\net_private.key")) {
            Write-Host "    使用默认密钥模板" -ForegroundColor Yellow
            Copy-Item -Path "xuperchain\data\mock\$nodeName\data\netkeys\*" -Destination "$dataDir\netkeys\" -Force -ErrorAction SilentlyContinue
        }
    }
    
    # 第三步：获取P2P地址（需要读取netkeys生成netURL）
    Write-Host "  获取节点P2P地址..." -ForegroundColor Cyan
    for ($i = 1; $i -le 3; $i++) {
        $nodeName = "node$i"
        $nodePort = $ports[$nodeName]
        $nodeDir = "$chainDir\$nodeName"
        $dataDir = "$nodeDir\data"
        
        # 尝试从netkeys生成netURL（简化处理，使用占位符）
        # 实际部署时需要运行: xchain-cli netURL preview --path data/netkeys/
        $p2pAddress = "/ip4/0.0.0.0/tcp/$($nodePort.P2p)/p2p/PLACEHOLDER$i"
        $chainAddresses[$nodeName] = $p2pAddress
    }
    
    $nodeAddresses[$chainName] = $chainAddresses
    
    # 第四步：更新network.yaml配置bootNodes
    Write-Host "  配置节点连接..." -ForegroundColor Cyan
    for ($i = 1; $i -le 3; $i++) {
        $nodeName = "node$i"
        $nodeDir = "$chainDir\$nodeName"
        $confDir = "$nodeDir\conf"
        $nodePort = $ports[$nodeName]
        
        $networkYaml = Get-Content "$confDir\network.yaml" -Raw
        
        # 生成bootNodes列表（连接其他节点）
        $bootNodesList = @()
        for ($j = 1; $j -le 3; $j++) {
            if ($j -ne $i) {
                $otherNodePort = $ports["node$j"]
                $bootNodesList += "  - `/"/ip4/0.0.0.0/tcp/$($otherNodePort.P2p)/p2p/PLACEHOLDER$j`""
            }
        }
        
        # 替换bootNodes配置
        if ($networkYaml -match "#bootNodes:") {
            $bootNodesSection = "bootNodes:`n" + ($bootNodesList -join "`n")
            $networkYaml = $networkYaml -replace "(#bootNodes:.*?)(# service name)", "$bootNodesSection`n`$2"
        } elseif ($networkYaml -notmatch "bootNodes:") {
            # 如果没有bootNodes配置，添加
            $bootNodesSection = "`n# BootNodes config the bootNodes the node to connect`nbootNodes:`n" + ($bootNodesList -join "`n") + "`n"
            $networkYaml = $networkYaml -replace "(keyPath: netkeys)", "`$1$bootNodesSection"
        }
        
        Set-Content -Path "$confDir\network.yaml" -Value $networkYaml
    }
    
    # 第五步：创建tdpos共识的genesis文件
    Write-Host "  创建tdpos共识配置..." -ForegroundColor Cyan
    $genesisTemplate = @{
        version = "1"
        predistribution = @(
            @{
                address = "TeyyPLpp9L7QAcxHangtcHTu7HUZ6iydY"
                quota = "100000000000000000000"
            }
        )
        maxblocksize = "128"
        award = "1000000"
        decimals = "8"
        award_decay = @{
            height_gap = 31536000
            ratio = 1
        }
        gas_price = @{
            cpu_rate = 1000
            mem_rate = 1000000
            disk_rate = 1
            xfee_rate = 1
        }
        new_account_resource_amount = 1000
        genesis_consensus = @{
            name = "tdpos"
            config = @{
                timestamp = "1559021720000000000"
                proposer_num = "3"
                period = "3000"
                alternate_interval = "3000"
                term_interval = "6000"
                block_num = "20"
                vote_unit_price = "1"
                init_proposer = @{
                    "1" = @(
                        "TeyyPLpp9L7QAcxHangtcHTu7HUZ6iydY",
                        "SmJG3rH2ZzYQ9ojxhbRCPwFiE9y6pD1Co",
                        "Y4TmpfV4p2YT7nqss61G2xa5ZH8YtAZ2R"
                    )
                }
                init_proposer_neturl = @{
                    "1" = @(
                        "/ip4/0.0.0.0/tcp/$($ports.node1.P2p)/p2p/PLACEHOLDER1",
                        "/ip4/0.0.0.0/tcp/$($ports.node2.P2p)/p2p/PLACEHOLDER2",
                        "/ip4/0.0.0.0/tcp/$($ports.node3.P2p)/p2p/PLACEHOLDER3"
                    )
                }
            }
        }
    }
    
    $genesisJson = $genesisTemplate | ConvertTo-Json -Depth 10
    foreach ($nodeName in @("node1", "node2", "node3")) {
        $nodeDir = "$chainDir\$nodeName"
        $dataDir = "$nodeDir\data"
        Set-Content -Path "$dataDir\genesis\$($chain.ChainName).json" -Value $genesisJson
    }
    
    # 第六步：更新engine.yaml，设置正确的rootChain
    Write-Host "  更新engine.yaml配置..." -ForegroundColor Cyan
    foreach ($nodeName in @("node1", "node2", "node3")) {
        $nodeDir = "$chainDir\$nodeName"
        $confDir = "$nodeDir\conf"
        $engineYaml = Get-Content "$confDir\engine.yaml" -Raw
        
        # 主链保持rootChain为xuper，副链设置为自己的链名（作为独立链）
        if ($chain.ChainName -eq "xuper") {
            # 主链保持xuper
            $engineYaml = $engineYaml -replace "rootChain: .+", "rootChain: xuper"
        } else {
            # 副链设置为自己的链名（独立链，不依赖主链）
            $engineYaml = $engineYaml -replace "rootChain: .+", "rootChain: $($chain.ChainName)"
        }
        
        Set-Content -Path "$confDir\engine.yaml" -Value $engineYaml
    }
    
    # 第六步：复制账户密钥
    Write-Host "  配置账户密钥..." -ForegroundColor Cyan
    for ($i = 1; $i -le 3; $i++) {
        $nodeName = "node$i"
        $nodeDir = "$chainDir\$nodeName"
        $dataDir = "$nodeDir\data"
        
        # 复制默认密钥（如果存在）
        $sourceKeys = "xuperchain\data\mock\$nodeName\data\keys"
        if (Test-Path $sourceKeys) {
            Copy-Item -Path "$sourceKeys\*" -Destination "$dataDir\keys\" -Force -ErrorAction SilentlyContinue
        } else {
            # 使用默认keys
            Copy-Item -Path "xuperchain\data\mock\data\keys\*" -Destination "$dataDir\keys\" -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "`n所有多节点配置已创建完成！" -ForegroundColor Green
Write-Host "`n注意:" -ForegroundColor Yellow
Write-Host "1. 需要先构建Docker镜像: docker-compose -f docker-compose.yml build" -ForegroundColor Yellow
Write-Host "2. 需要为每个节点生成实际的P2P地址（netURL）" -ForegroundColor Yellow
Write-Host "3. 更新genesis.json和network.yaml中的PLACEHOLDER为实际P2P地址" -ForegroundColor Yellow
Write-Host "4. 运行 init-chains.ps1 初始化4条独立的链" -ForegroundColor Yellow
