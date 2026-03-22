# Generate 30 health data records with some abnormal data
$names = @("John", "Alice", "Bob", "Emma", "David", "Sarah", "Mike", "Lisa", "Tom", "Anna", "Chris", "Mary", "Jack", "Sophia", "Ryan", "Olivia", "Daniel", "Emily", "James", "Grace", "William", "Lily", "Robert", "Zoe", "Michael", "Ella", "Richard", "Mia", "Joseph", "Ava")
$cities = @("Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Hangzhou", "Chengdu", "Nanjing", "Wuhan", "Xi'an", "Tianjin")
$addresses = @("123 Main Street", "456 Park Avenue", "789 Oak Road", "321 Elm Street", "654 Pine Avenue", "987 Maple Drive", "147 Cedar Lane", "258 Birch Street", "369 Willow Way", "741 Spruce Court")

$baseDate = Get-Date -Format "yyyyMMdd"
$records = @()

for ($i = 1; $i -le 30; $i++) {
    $id = "HEALTH$baseDate" + $i.ToString("000")
    $name = $names[$i - 1]
    $city = $cities[($i - 1) % $cities.Length]
    $address = $addresses[($i - 1) % $addresses.Length] + ", $city"
    
    # Generate normal or abnormal data
    $isAbnormal = $false
    $heartRate = 0
    $temperature = 0
    $latitude = 0
    $longitude = 0
    
    # Create some abnormal records (about 20% abnormal)
    if ($i -in @(3, 7, 12, 18, 25)) {
        $isAbnormal = $true
        # Abnormal heart rate (too high or too low)
        if ($i % 2 -eq 0) {
            $heartRate = Get-Random -Minimum 110 -Maximum 150  # Tachycardia
        } else {
            $heartRate = Get-Random -Minimum 40 -Maximum 55     # Bradycardia
        }
        # Abnormal temperature
        if ($i % 2 -eq 0) {
            $temperature = [Math]::Round((Get-Random -Minimum 38.0 -Maximum 40.0), 1)  # Fever
        } else {
            $temperature = [Math]::Round((Get-Random -Minimum 35.0 -Maximum 35.9), 1)  # Hypothermia
        }
        # Abnormal location (out of range coordinates)
        $latitude = [Math]::Round((Get-Random -Minimum 90.0 -Maximum 100.0), 4)  # Invalid latitude
        $longitude = [Math]::Round((Get-Random -Minimum 180.0 -Maximum 200.0), 4)  # Invalid longitude
    } else {
        # Normal data
        $heartRate = Get-Random -Minimum 60 -Maximum 100
        $temperature = [Math]::Round((Get-Random -Minimum 36.0 -Maximum 37.5), 1)
        # Valid coordinates for China
        $latitude = [Math]::Round((Get-Random -Minimum 18.0 -Maximum 54.0), 4)
        $longitude = [Math]::Round((Get-Random -Minimum 73.0 -Maximum 135.0), 4)
    }
    
    $timestamp = (Get-Date).AddMinutes(-$i * 5).ToString("yyyy-MM-dd HH:mm:ss")
    $delay = Get-Random -Minimum 20 -Maximum 50
    $availability = Get-Random -Minimum 95 -Maximum 100
    
    $healthData = @{
        name = $name
        heartRate = $heartRate
        temperature = $temperature
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
        healthData = $healthData
        qos = $qos
    }
    
    $records += $record
}

# Output as JSON
$records | ConvertTo-Json -Depth 10 | Out-File -FilePath "health-data-30.json" -Encoding UTF8
Write-Host "Generated 30 health data records (5 abnormal) saved to health-data-30.json"


