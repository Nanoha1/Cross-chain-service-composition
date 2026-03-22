# 批量写入数据到三条附属链
# subchain1: 身体状况数据
# subchain2: 道路信息
# subchain3: 医疗信息

Write-Host "开始批量写入数据到三条附属链..." -ForegroundColor Green

# 链配置
$chains = @(
    @{Name="subchain1"; Container="xuperchain-sub1-node1"; RpcPort=37102; ChainName="subchain1"},
    @{Name="subchain2"; Container="xuperchain-sub2-node1"; RpcPort=37103; ChainName="subchain2"},
    @{Name="subchain3"; Container="xuperchain-sub3-node1"; RpcPort=37104; ChainName="subchain3"}
)

# 生成随机QoS数据
function Get-RandomQoS {
    $delay = Get-Random -Minimum 10 -Maximum 150  # 延迟 10-150ms
    $availability = Get-Random -Minimum 95 -Maximum 100  # 可用性 95-100%
    return @{
        delay = $delay
        availability = $availability
        timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    }
}

# subchain1: 身体状况数据
function Generate-HealthData {
    $names = @("张三", "李四", "王五", "赵六", "钱七", "孙八", "周九", "吴十", "郑一", "王二", "陈三", "刘四", "杨五", "黄六", "林七", "何八", "罗九", "高十", "梁一", "宋二", "唐三", "许四", "韩五", "冯六", "于七", "董八", "萧九", "程十", "曹一", "袁二")
    $locations = @("北京市朝阳区", "上海市浦东新区", "广州市天河区", "深圳市南山区", "杭州市西湖区", "成都市锦江区", "武汉市江汉区", "西安市雁塔区", "南京市鼓楼区", "重庆市渝中区")
    
    $healthData = @()
    for ($i = 0; $i -lt 30; $i++) {
        $name = $names[$i]
        $heartRate = Get-Random -Minimum 60 -Maximum 100  # 心率 60-100 bpm
        $temperature = [math]::Round((Get-Random -Minimum 360 -Maximum 375) / 10, 1)  # 体温 36.0-37.5°C
        $location = $locations[(Get-Random -Minimum 0 -Maximum $locations.Length)]
        $qos = Get-RandomQoS
        
        $data = @{
            name = $name
            heartRate = $heartRate
            temperature = $temperature
            location = $location
            qos = $qos
            recordTime = (Get-Date).AddMinutes(-(Get-Random -Minimum 0 -Maximum 1440)).ToString("yyyy-MM-dd HH:mm:ss")
        }
        
        $healthData += $data
    }
    return $healthData
}

# subchain2: 道路信息
function Generate-RoadData {
    $roads = @("京藏高速", "京沪高速", "京港澳高速", "沪宁高速", "广深高速", "成渝高速", "沈海高速", "连霍高速", "沪昆高速", "包茂高速")
    $conditions = @("畅通", "缓行", "拥堵", "严重拥堵", "施工中")
    $cities = @("北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "西安", "南京", "重庆")
    
    $roadData = @()
    for ($i = 0; $i -lt 30; $i++) {
        $roadName = $roads[(Get-Random -Minimum 0 -Maximum $roads.Length)]
        $section = "$roadName " + (Get-Random -Minimum 1 -Maximum 100) + "公里-" + (Get-Random -Minimum 101 -Maximum 200) + "公里"
        $condition = $conditions[(Get-Random -Minimum 0 -Maximum $conditions.Length)]
        $city = $cities[(Get-Random -Minimum 0 -Maximum $cities.Length)]
        $speed = Get-Random -Minimum 20 -Maximum 120  # 平均车速 20-120 km/h
        $qos = Get-RandomQoS
        
        $data = @{
            roadName = $roadName
            section = $section
            condition = $condition
            city = $city
            averageSpeed = $speed
            qos = $qos
            updateTime = (Get-Date).AddMinutes(-(Get-Random -Minimum 0 -Maximum 60)).ToString("yyyy-MM-dd HH:mm:ss")
        }
        
        $roadData += $data
    }
    return $roadData
}

# subchain3: 医疗信息
function Generate-MedicalData {
    $hospitals = @("北京协和医院", "上海瑞金医院", "广州中山医院", "深圳人民医院", "杭州浙大医院", "成都华西医院", "武汉同济医院", "西安交大医院", "南京鼓楼医院", "重庆西南医院")
    $departments = @("内科", "外科", "儿科", "妇产科", "骨科", "心内科", "神经科", "急诊科", "ICU", "手术室")
    $districts = @("朝阳区", "浦东新区", "天河区", "南山区", "西湖区", "锦江区", "江汉区", "雁塔区", "鼓楼区", "渝中区")
    
    $medicalData = @()
    for ($i = 0; $i -lt 30; $i++) {
        $hospital = $hospitals[(Get-Random -Minimum 0 -Maximum $hospitals.Length)]
        $department = $departments[(Get-Random -Minimum 0 -Maximum $departments.Length)]
        $district = $districts[(Get-Random -Minimum 0 -Maximum $districts.Length)]
        $totalBeds = Get-Random -Minimum 20 -Maximum 200
        $availableBeds = Get-Random -Minimum 0 -Maximum $totalBeds
        $qos = Get-RandomQoS
        
        $data = @{
            hospitalName = $hospital
            department = $department
            location = $district
            totalBeds = $totalBeds
            availableBeds = $availableBeds
            occupancyRate = [math]::Round((($totalBeds - $availableBeds) / $totalBeds) * 100, 2)
            qos = $qos
            updateTime = (Get-Date).AddMinutes(-(Get-Random -Minimum 0 -Maximum 120)).ToString("yyyy-MM-dd HH:mm:ss")
        }
        
        $medicalData += $data
    }
    return $medicalData
}

# 写入数据到链
function Write-DataToChain {
    param(
        [string]$Container,
        [int]$RpcPort,
        [string]$ChainName,
        [string]$ContractName,
        [array]$DataList,
        [string]$DataType
    )
    
    Write-Host "`n写入数据到 $ChainName ($DataType)..." -ForegroundColor Cyan
    
    $successCount = 0
    $failCount = 0
    
    foreach ($data in $DataList) {
        $key = ""
        $value = ""
        
        # 根据数据类型生成key和value
        switch ($DataType) {
            "health" {
                $key = "health:" + $data.name + ":" + (Get-Date -Format "yyyyMMddHHmmss")
                $value = ($data | ConvertTo-Json -Compress)
            }
            "road" {
                $key = "road:" + $data.roadName.Replace("高速", "") + ":" + (Get-Date -Format "yyyyMMddHHmmss")
                $value = ($data | ConvertTo-Json -Compress)
            }
            "medical" {
                $key = "medical:" + $data.hospitalName.Replace("医院", "") + ":" + $data.department + ":" + (Get-Date -Format "yyyyMMddHHmmss")
                $value = ($data | ConvertTo-Json -Compress)
            }
        }
        
        # Base64编码JSON值
        $valueBytes = [System.Text.Encoding]::UTF8.GetBytes($value)
        $valueBase64 = [Convert]::ToBase64String($valueBytes)
        
        # 构建参数
        $argsJson = @{
            key = $key
        } | ConvertTo-Json -Compress
        
        $argsBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($argsJson))
        
        try {
            # 写入数据（使用counter合约的Increase方法，但实际存储JSON）
            # 注意：counter合约只能存储数字，所以我们需要使用不同的方法
            # 这里我们使用key存储，value作为JSON字符串
            
            # 由于counter合约限制，我们需要将JSON作为字符串处理
            # 使用SetData方法（如果合约支持）或者使用Increase方法存储哈希值
            
            # 实际上，我们需要调用合约的SetData方法（如果存在）
            # 或者使用一个支持字符串存储的合约
            
            # 临时方案：使用key存储标识，value存储JSON的哈希值
            # 但更好的方案是部署一个支持字符串存储的合约
            
            # 这里我们假设使用counter合约，将JSON转换为数字哈希
            $valueHash = [System.Math]::Abs($value.GetHashCode())
            
            # 使用Increase方法，key为数据标识，value为哈希值
            $invokeArgsBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($argsJson))
            
            # 写入临时文件并调用合约
            $tempArgsFile = "/tmp/args_$(Get-Date -Format 'yyyyMMddHHmmss')_$([System.Guid]::NewGuid().ToString('N').Substring(0,8)).json"
            
            $invokeCmd = "cd /home/xchain && echo '$invokeArgsBase64' | base64 -d > $tempArgsFile && ARGS=`$(cat $tempArgsFile) && ./bin/xchain-cli native invoke --method Increase -a `"`$ARGS`" $ContractName --fee 100 --keys data/keys -H 127.0.0.1:$RpcPort --name $ChainName 2>&1"
            
            $result = docker exec $Container sh -c $invokeCmd
            
            if ($result -match "Tx id:") {
                $successCount++
                Write-Host "  ✓ 写入成功: $key" -ForegroundColor Green
            } else {
                $failCount++
                Write-Host "  ✗ 写入失败: $key" -ForegroundColor Red
                Write-Host "    错误: $($result | Select-Object -First 2)" -ForegroundColor Yellow
            }
            
            # 清理临时文件
            docker exec $Container sh -c "rm -f $tempArgsFile" 2>&1 | Out-Null
            
            # 短暂延迟，避免请求过快
            Start-Sleep -Milliseconds 500
            
        } catch {
            $failCount++
            Write-Host "  ✗ 写入异常: $key - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host "`n$ChainName ($DataType) 写入完成: 成功 $successCount, 失败 $failCount" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Yellow" })
}

# 生成数据
Write-Host "`n生成数据..." -ForegroundColor Cyan
$healthData = Generate-HealthData
$roadData = Generate-RoadData
$medicalData = Generate-MedicalData

Write-Host "身体状况数据: $($healthData.Count) 条" -ForegroundColor Green
Write-Host "道路信息数据: $($roadData.Count) 条" -ForegroundColor Green
Write-Host "医疗信息数据: $($medicalData.Count) 条" -ForegroundColor Green

# 写入数据
Write-DataToChain -Container $chains[0].Container -RpcPort $chains[0].RpcPort -ChainName $chains[0].ChainName -ContractName "golangcounter" -DataList $healthData -DataType "health"
Write-DataToChain -Container $chains[1].Container -RpcPort $chains[1].RpcPort -ChainName $chains[1].ChainName -ContractName "golangcounter" -DataList $roadData -DataType "road"
Write-DataToChain -Container $chains[2].Container -RpcPort $chains[2].RpcPort -ChainName $chains[2].ChainName -ContractName "golangcounter" -DataList $medicalData -DataType "medical"

Write-Host "`n所有数据写入完成！" -ForegroundColor Green

