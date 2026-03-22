# Generate 30 road data records with some abnormal data
$roadNames = @("Highway1", "Highway2", "Expressway3", "Main Road", "Ring Road", "Bridge Road", "Tunnel Road", "Coastal Highway", "Mountain Road", "Urban Expressway")
$sections = @("0km-50km", "50km-100km", "100km-150km", "150km-200km", "200km-250km", "0km-30km", "30km-60km", "60km-90km", "90km-120km", "120km-150km")
$conditions = @("Fluid", "Slow", "Congested", "Blocked")
$cities = @("Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Hangzhou", "Chengdu", "Nanjing", "Wuhan", "Xi'an", "Tianjin")

$baseDate = Get-Date -Format "yyyyMMdd"
$records = @()

for ($i = 1; $i -le 30; $i++) {
    $id = "ROAD$baseDate" + $i.ToString("000")
    $roadName = $roadNames[($i - 1) % $roadNames.Length]
    $section = $sections[($i - 1) % $sections.Length]
    $city = $cities[($i - 1) % $cities.Length]
    
    # Generate normal or abnormal data
    $isAbnormal = $false
    $condition = ""
    $averageSpeed = 0
    $latitude = 0
    $longitude = 0
    
    # Create some abnormal records (about 20% abnormal)
    if ($i -in @(4, 9, 14, 19, 26)) {
        $isAbnormal = $true
        # Abnormal condition (blocked or severely congested)
        $condition = if ($i % 2 -eq 0) { "Blocked" } else { "Congested" }
        # Abnormal speed (very slow or negative/invalid)
        if ($i % 2 -eq 0) {
            $averageSpeed = Get-Random -Minimum 0 -Maximum 10  # Very slow
        } else {
            $averageSpeed = Get-Random -Minimum -10 -Maximum 0  # Invalid negative speed
        }
        # Abnormal location (out of range coordinates)
        $latitude = [Math]::Round((Get-Random -Minimum 90.0 -Maximum 100.0), 4)  # Invalid latitude
        $longitude = [Math]::Round((Get-Random -Minimum 180.0 -Maximum 200.0), 4)  # Invalid longitude
    } else {
        # Normal data
        $conditionIndex = Get-Random -Minimum 0 -Maximum 3
        $condition = $conditions[$conditionIndex]  # Fluid, Slow, or Congested
        $averageSpeed = Get-Random -Minimum 30 -Maximum 120
        # Valid coordinates for China
        $latitude = [Math]::Round((Get-Random -Minimum 18.0 -Maximum 54.0), 4)
        $longitude = [Math]::Round((Get-Random -Minimum 73.0 -Maximum 135.0), 4)
    }
    
    $address = "$roadName, Section $section, $city"
    $timestamp = (Get-Date).AddMinutes(-$i * 5).ToString("yyyy-MM-dd HH:mm:ss")
    $delay = Get-Random -Minimum 20 -Maximum 50
    $availability = Get-Random -Minimum 95 -Maximum 100
    
    $roadData = @{
        roadName = $roadName
        section = $section
        condition = $condition
        averageSpeed = $averageSpeed
        latitude = $latitude
        longitude = $longitude
        address = $address
    }
    
    $qos = @{
        delay = $delay
        availability = $availability
        timestamp = $timestamp
    }
    
    $record = @{
        id = $id
        roadData = $roadData
        qos = $qos
    }
    
    $records += $record
}

# Output as JSON
$records | ConvertTo-Json -Depth 10 | Out-File -FilePath "road-data-30.json" -Encoding UTF8
Write-Host "Generated 30 road data records (5 abnormal) saved to road-data-30.json"

