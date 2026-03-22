# 修复多节点网络配置脚本
# 在Docker容器启动后，动态获取IP地址并更新network.yaml

Write-Host "开始修复多节点网络配置..." -ForegroundColor Green

# 定义节点映射关系
$nodeMapping = @{
    "mainchain" = @{
        "node1" = @{Container="xuperchain-main-node1"; P2pPort=47101; P2pId="Qmf2HeHe4sspGkfRCTq6257Vm3UHzvh2TeQJHHvHzzuFw6"}
        "node2" = @{Container="xuperchain-main-node2"; P2pPort=47111; P2pId="QmQKp8pLWSgV4JiGjuULKV1JsdpxUtnDEUMP8sGaaUbwVL"}
        "node3" = @{Container="xuperchain-main-node3"; P2pPort=47121; P2pId="QmZXjZibcL5hy2Ttv5CnAQnssvnCbPEGBzqk7sAnL69R1E"}
    }
    "subchain1" = @{
        "node1" = @{Container="xuperchain-sub1-node1"; P2pPort=47102; P2pId="Qmf2HeHe4sspGkfRCTq6257Vm3UHzvh2TeQJHHvHzzuFw6"}
        "node2" = @{Container="xuperchain-sub1-node2"; P2pPort=47112; P2pId="QmQKp8pLWSgV4JiGjuULKV1JsdpxUtnDEUMP8sGaaUbwVL"}
        "node3" = @{Container="xuperchain-sub1-node3"; P2pPort=47122; P2pId="QmZXjZibcL5hy2Ttv5CnAQnssvnCbPEGBzqk7sAnL69R1E"}
    }
    "subchain2" = @{
        "node1" = @{Container="xuperchain-sub2-node1"; P2pPort=47103; P2pId="Qmf2HeHe4sspGkfRCTq6257Vm3UHzvh2TeQJHHvHzzuFw6"}
        "node2" = @{Container="xuperchain-sub2-node2"; P2pPort=47113; P2pId="QmQKp8pLWSgV4JiGjuULKV1JsdpxUtnDEUMP8sGaaUbwVL"}
        "node3" = @{Container="xuperchain-sub2-node3"; P2pPort=47123; P2pId="QmZXjZibcL5hy2Ttv5CnAQnssvnCbPEGBzqk7sAnL69R1E"}
    }
    "subchain3" = @{
        "node1" = @{Container="xuperchain-sub3-node1"; P2pPort=47104; P2pId="Qmf2HeHe4sspGkfRCTq6257Vm3UHzvh2TeQJHHvHzzuFw6"}
        "node2" = @{Container="xuperchain-sub3-node2"; P2pPort=47114; P2pId="QmQKp8pLWSgV4JiGjuULKV1JsdpxUtnDEUMP8sGaaUbwVL"}
        "node3" = @{Container="xuperchain-sub3-node3"; P2pPort=47124; P2pId="QmZXjZibcL5hy2Ttv5CnAQnssvnCbPEGBzqk7sAnL69R1E"}
    }
}

# 获取Docker网络名称
$networkName = "spchain_xuperchain-network"
$networkExists = docker network ls | Select-String $networkName

if (-not $networkExists) {
    Write-Host "Docker网络 $networkName 不存在，请先启动容器" -ForegroundColor Yellow
    exit 1
}

# 为每个链的每个节点更新配置
foreach ($chainName in $nodeMapping.Keys) {
    $chainNodes = $nodeMapping[$chainName]
    
    Write-Host "`n处理链: $chainName" -ForegroundColor Yellow
    
    foreach ($nodeName in $chainNodes.Keys) {
        $nodeInfo = $chainNodes[$nodeName]
        $containerName = $nodeInfo.Container
        $networkYamlPath = "chains\$chainName\$nodeName\conf\network.yaml"
        
        # 检查容器是否存在
        $containerExists = docker ps -a --format "{{.Names}}" | Select-String $containerName
        if (-not $containerExists) {
            Write-Host "  跳过 $nodeName: 容器 $containerName 不存在" -ForegroundColor Gray
            continue
        }
        
        # 获取容器IP地址
        $containerIP = docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $containerName 2>$null
        if (-not $containerIP -or $containerIP -eq "") {
            Write-Host "  跳过 $nodeName: 无法获取容器IP" -ForegroundColor Gray
            continue
        }
        
        Write-Host "  $nodeName: $containerName -> $containerIP" -ForegroundColor Cyan
        
        # 读取network.yaml
        if (-not (Test-Path $networkYamlPath)) {
            Write-Host "  跳过 $nodeName: network.yaml不存在" -ForegroundColor Gray
            continue
        }
        
        $networkYaml = Get-Content $networkYamlPath -Raw
        
        # 更新address字段
        $networkYaml = $networkYaml -replace "address: /ip4/[^/]+/tcp/\d+", "address: /ip4/$containerIP/tcp/$($nodeInfo.P2pPort)"
        
        # 生成bootNodes列表（排除自己）
        $bootNodesList = @()
        foreach ($otherNodeName in $chainNodes.Keys) {
            if ($otherNodeName -eq $nodeName) {
                continue
            }
            
            $otherNodeInfo = $chainNodes[$otherNodeName]
            $otherContainerName = $otherNodeInfo.Container
            
            # 获取其他节点的IP
            $otherContainerIP = docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $otherContainerName 2>$null
            if ($otherContainerIP -and $otherContainerIP -ne "") {
                $bootNode = "/ip4/$otherContainerIP/tcp/$($otherNodeInfo.P2pPort)/p2p/$($otherNodeInfo.P2pId)"
                $bootNodesList += "  - `"$bootNode`""
                Write-Host "    添加bootNode: $otherNodeName -> $otherContainerIP" -ForegroundColor Gray
            }
        }
        
        # 更新bootNodes配置
        if ($bootNodesList.Count -gt 0) {
            $bootNodesSection = "bootNodes:`n" + ($bootNodesList -join "`n")
            
            # 替换现有的bootNodes配置
            if ($networkYaml -match "bootNodes:") {
                # 找到bootNodes到下一个配置项之间的内容并替换
                $networkYaml = $networkYaml -replace "(bootNodes:)[\s\S]*?(?=\n#|$)", "`$1`n" + ($bootNodesList -join "`n") + "`n"
            } else {
                # 添加bootNodes配置
                $networkYaml = $networkYaml -replace "(keyPath: netkeys)", "`$1`n`n# BootNodes config the bootNodes the node to connect`n$bootNodesSection"
            }
        }
        
        # 保存更新后的配置
        Set-Content -Path $networkYamlPath -Value $networkYaml -NoNewline
        
        Write-Host "  $nodeName 配置已更新" -ForegroundColor Green
    }
}

Write-Host "`n网络配置修复完成！" -ForegroundColor Green
Write-Host "现在可以重启容器: docker-compose -f docker-compose.yml restart" -ForegroundColor Cyan

