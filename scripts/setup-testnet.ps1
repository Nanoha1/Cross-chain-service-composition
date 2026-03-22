# 使用XuperChain的testnet方式配置多节点网络

Write-Host "开始使用testnet方式配置多节点网络..." -ForegroundColor Green

# 检查Docker镜像是否存在
$imageName = "spchain-main-node1"
$imageExists = docker images -q $imageName 2>$null

if (-not $imageExists) {
    Write-Host "构建Docker镜像..." -ForegroundColor Yellow
    docker-compose build main-node1
    $imageName = "spchain-main-node1"
}

# 在容器内运行make testnet
Write-Host "`n在容器内运行make testnet..." -ForegroundColor Cyan
$testnetResult = docker run --rm `
    -v "${PWD}/xuperchain:/workspace" `
    -w /workspace `
    $imageName `
    bash -c "cd /workspace && make testnet 2>&1"

if ($LASTEXITCODE -ne 0) {
    Write-Host "make testnet失败，尝试直接使用mock数据..." -ForegroundColor Yellow
} else {
    Write-Host "testnet配置生成成功" -ForegroundColor Green
}

# 为每条链配置3个节点
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

# 从mock数据中读取节点地址
$nodeAddresses = @{
    "node1" = "TeyyPLpp9L7QAcxHangtcHTu7HUZ6iydY"
    "node2" = "SmJG3rH2ZzYQ9ojxhbRCPwFiE9y6pD1Co"
    "node3" = "iYjtLcW6SVCiousAb5DFKWtWroahhEj4u"
}

# 从mock数据中读取P2P地址
$nodeP2PAddresses = @{
    "node1" = "/ip4/0.0.0.0/tcp/47101/p2p/Qmf2HeHe4sspGkfRCTq6257Vm3UHzvh2TeQJHHvHzzuFw6"
    "node2" = "/ip4/0.0.0.0/tcp/47102/p2p/QmQKp8pLWSgV4JiGjuULKV1JsdpxUtnDEUMP8sGaaUbwVL"
    "node3" = "/ip4/0.0.0.0/tcp/47103/p2p/QmZXjZibcL5hy2Ttv5CnAQnssvnCbPEGBzqk7sAnL69R1E"
}

foreach ($chain in $chains) {
    $chainName = $chain.Name
    $chainDir = "chains\$chainName"
    $ports = $nodePorts[$chainName]
    
    Write-Host "`n处理链: $chainName" -ForegroundColor Yellow
    
    # 为每个节点创建配置
    for ($i = 1; $i -le 3; $i++) {
        $nodeName = "node$i"
        $nodeDir = "$chainDir\$nodeName"
        $confDir = "$nodeDir\conf"
        $dataDir = "$nodeDir\data"
        $logsDir = "$nodeDir\logs"
        $tmpDir = "$nodeDir\tmp"
        
        $nodePort = $ports[$nodeName]
        $mockNodeName = "node$i"
        
        # 创建目录
        New-Item -ItemType Directory -Force -Path $nodeDir | Out-Null
        New-Item -ItemType Directory -Force -Path $confDir | Out-Null
        New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
        New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
        New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
        New-Item -ItemType Directory -Force -Path "$dataDir\genesis" | Out-Null
        New-Item -ItemType Directory -Force -Path "$dataDir\keys" | Out-Null
        New-Item -ItemType Directory -Force -Path "$dataDir\netkeys" | Out-Null
        
        # 复制mock节点的配置和数据
        $mockConfPath = "xuperchain\data\mock\$mockNodeName\conf"
        $mockDataPath = "xuperchain\data\mock\$mockNodeName\data"
        
        if (Test-Path $mockConfPath) {
            Copy-Item -Path "$mockConfPath\*" -Destination $confDir -Recurse -Force
        } else {
            # 如果mock数据不存在，复制默认配置
            Copy-Item -Path "xuperchain\conf\*" -Destination $confDir -Recurse -Force
        }
        
        if (Test-Path $mockDataPath) {
            Copy-Item -Path "$mockDataPath\keys\*" -Destination "$dataDir\keys\" -Force -ErrorAction SilentlyContinue
            Copy-Item -Path "$mockDataPath\netkeys\*" -Destination "$dataDir\netkeys\" -Force -ErrorAction SilentlyContinue
        }
        
        # 复制genesis文件
        Copy-Item -Path "xuperchain\data\genesis\*" -Destination "$dataDir\genesis\" -Force -ErrorAction SilentlyContinue
        
        # 更新server.yaml
        $serverYaml = Get-Content "$confDir\server.yaml" -Raw
        $serverYaml = $serverYaml -replace "rpcPort: \d+", "rpcPort: $($nodePort.Rpc)"
        $serverYaml = $serverYaml -replace "GWPort: \d+", "GWPort: $($nodePort.Gw)"
        $metricPort = $nodePort.Rpc + 100
        $serverYaml = $serverYaml -replace "metricPort: \d+", "metricPort: $metricPort"
        Set-Content -Path "$confDir\server.yaml" -Value $serverYaml
        
        # 更新network.yaml - 使用testnet的配置方式
        $networkYaml = Get-Content "$confDir\network.yaml" -Raw
        
        # 更新端口
        $networkYaml = $networkYaml -replace "port: \d+", "port: $($nodePort.P2p)"
        $networkYaml = $networkYaml -replace "/ip4/127\.0\.0\.1/tcp/\d+", "/ip4/0.0.0.0/tcp/$($nodePort.P2p)"
        $networkYaml = $networkYaml -replace "/ip4/0\.0\.0\.0/tcp/\d+", "/ip4/0.0.0.0/tcp/$($nodePort.P2p)"
        
        # 更新bootNodes - 为当前链的所有节点生成bootNodes（排除自己）
        $bootNodesList = @()
        for ($j = 1; $j -le 3; $j++) {
            if ($j -eq $i) {
                continue  # 跳过自己
            }
            $otherNodePort = $ports["node$j"]
            # 使用testnet的P2P地址格式，但更新端口
            $p2pBase = $nodeP2PAddresses["node$j"]
            # 提取P2P ID部分
            if ($p2pBase -match "/p2p/(.+)") {
                $p2pId = $matches[1]
                $p2pAddress = "/ip4/0.0.0.0/tcp/$($otherNodePort.P2p)/p2p/$p2pId"
                $bootNodesList += "  - `"$p2pAddress`""
            }
        }
        
        # 替换bootNodes配置
        if ($networkYaml -match "bootNodes:") {
            $bootNodesSection = "bootNodes:`n" + ($bootNodesList -join "`n")
            $networkYaml = $networkYaml -replace "bootNodes:.*?(?=# service name)", "$bootNodesSection`n"
        } else {
            # 添加bootNodes配置
            $bootNodesSection = "`n# BootNodes config the bootNodes the node to connect`nbootNodes:`n" + ($bootNodesList -join "`n") + "`n"
            $networkYaml = $networkYaml -replace "(keyPath: netkeys)", "`$1$bootNodesSection"
        }
        
        Set-Content -Path "$confDir\network.yaml" -Value $networkYaml
        
        # 更新engine.yaml
        if ($chainName -eq "mainchain") {
            $engineYaml = Get-Content "$confDir\engine.yaml" -Raw
            $engineYaml = $engineYaml -replace "rootChain: .+", "rootChain: $($chain.ChainName)"
            Set-Content -Path "$confDir\engine.yaml" -Value $engineYaml
        }
        
        # 更新genesis.json - 使用single共识（testnet默认）
        $genesisPath = "$dataDir\genesis\$($chain.ChainName).json"
        if (Test-Path $genesisPath) {
            $genesisContent = Get-Content $genesisPath -Raw | ConvertFrom-Json
            # 确保使用single共识
            if ($genesisContent.genesis_consensus.name -ne "single") {
                $genesisContent.genesis_consensus = @{
                    name = "single"
                    config = @{
                        miner = $nodeAddresses["node1"]
                        period = "3000"
                    }
                }
                $genesisContent | ConvertTo-Json -Depth 10 | Set-Content -Path $genesisPath
            }
        }
        
        # 复制control.sh
        if (Test-Path "xuperchain\auto\control.sh") {
            Copy-Item -Path "xuperchain\auto\control.sh" -Destination "$nodeDir\control.sh" -Force
        }
        
        Write-Host "  节点 $nodeName 配置完成 (RPC: $($nodePort.Rpc), P2P: $($nodePort.P2p))" -ForegroundColor Green
    }
}

Write-Host "`n多节点配置完成！" -ForegroundColor Green
Write-Host "现在可以启动多节点集群: docker-compose -f docker-compose.yml up -d" -ForegroundColor Cyan

