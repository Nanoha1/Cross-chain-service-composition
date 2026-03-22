# Generate 30 medical data records with some abnormal data
$hospitalNames = @("Beijing General Hospital", "Shanghai Medical Center", "Guangzhou Hospital", "Shenzhen Health Center", "Hangzhou Medical Institute", "Chengdu Hospital", "Nanjing Medical Center", "Wuhan General Hospital", "Xi'an Health Center", "Tianjin Medical Institute")
$departments = @("Cardiology", "Neurology", "Orthopedics", "Pediatrics", "Emergency", "Surgery", "Internal Medicine", "Oncology", "Gynecology", "Dermatology")
$cities = @("Beijing", "Shanghai", "Guangzhou", "Shenzhen", "Hangzhou", "Chengdu", "Nanjing", "Wuhan", "Xi'an", "Tianjin")
$addresses = @("123 Medical Street", "456 Health Avenue", "789 Hospital Road", "321 Clinic Lane", "654 Medical Center", "987 Hospital Drive", "147 Health Plaza", "258 Medical Court", "369 Hospital Way", "741 Health Boulevard")

$baseDate = Get-Date -Format "yyyyMMdd"
$records = @()

for ($i = 1; $i -le 30; $i++) {
    $id = "MEDICAL$baseDate" + $i.ToString("000")
    $hospitalName = $hospitalNames[($i - 1) % $hospitalNames.Length]
    $department = $departments[($i - 1) % $departments.Length]
    $city = $cities[($i - 1) % $cities.Length]
    $address = $addresses[($i - 1) % $addresses.Length] + ", $city"
    
    # Generate normal or abnormal data
    $isAbnormal = $false
    $totalBeds = 0
    $availableBeds = 0
    $occupancyRate = 0.0
    $latitude = 0
    $longitude = 0
    
    # Create some abnormal records (about 20% abnormal)
    if ($i -in @(5, 11, 17, 23, 28)) {
        $isAbnormal = $true
        # Abnormal bed data (negative or invalid values)
        if ($i % 2 -eq 0) {
            $totalBeds = Get-Random -Minimum 100 -Maximum 200
            $availableBeds = Get-Random -Minimum 150 -Maximum 250  # More available than total (invalid)
            $occupancyRate = [Math]::Round((Get-Random -Minimum 120.0 -Maximum 150.0), 1)  # Over 100% (invalid)
        } else {
            $totalBeds = Get-Random -Minimum -50 -Maximum 0  # Negative (invalid)
            $availableBeds = Get-Random -Minimum -30 -Maximum 0  # Negative (invalid)
            $occupancyRate = [Math]::Round((Get-Random -Minimum -20.0 -Maximum 0.0), 1)  # Negative (invalid)
        }
        # Abnormal location (out of range coordinates)
        $latitude = [Math]::Round((Get-Random -Minimum 90.0 -Maximum 100.0), 4)  # Invalid latitude
        $longitude = [Math]::Round((Get-Random -Minimum 180.0 -Maximum 200.0), 4)  # Invalid longitude
    } else {
        # Normal data
        $totalBeds = Get-Random -Minimum 50 -Maximum 300
        $availableBeds = Get-Random -Minimum 0 -Maximum $totalBeds
        $occupancyRate = [Math]::Round((($totalBeds - $availableBeds) / $totalBeds * 100), 1)
        # Valid coordinates for China
        $latitude = [Math]::Round((Get-Random -Minimum 18.0 -Maximum 54.0), 4)
        $longitude = [Math]::Round((Get-Random -Minimum 73.0 -Maximum 135.0), 4)
    }
    
    $timestamp = (Get-Date).AddMinutes(-$i * 5).ToString("yyyy-MM-dd HH:mm:ss")
    $delay = Get-Random -Minimum 20 -Maximum 50
    $availability = Get-Random -Minimum 95 -Maximum 100
    
    $medicalData = @{
        hospitalName = $hospitalName
        department = $department
        totalBeds = $totalBeds
        availableBeds = $availableBeds
        occupancyRate = $occupancyRate
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
        medicalData = $medicalData
        qos = $qos
    }
    
    $records += $record
}

# Output as JSON
$records | ConvertTo-Json -Depth 10 | Out-File -FilePath "medical-data-30.json" -Encoding UTF8
Write-Host "Generated 30 medical data records (5 abnormal) saved to medical-data-30.json"


