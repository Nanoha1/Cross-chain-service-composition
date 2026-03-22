# Write 30 health data records to subchain1 using jsondata contract
$jsonData = Get-Content -Path "health-data-30.json" -Raw | ConvertFrom-Json
$container = "xuperchain-sub1-node1"
$rpcPort = 37102
$chainName = "subchain1"
$contractName = "jsondata"
$keysPath = "data/keys"

$successCount = 0
$failCount = 0

Write-Host "Starting to write 30 health data records to subchain1..." -ForegroundColor Green

foreach ($record in $jsonData) {
    try {
        # Convert record to JSON string
        $valueJson = $record | ConvertTo-Json -Compress -Depth 10
        
        # Build args object
        $key = $record.id
        $argsObj = @{
            key = $key
            value = $valueJson
        } | ConvertTo-Json -Compress
        
        # Base64 encode
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($argsObj)
        $base64 = [Convert]::ToBase64String($bytes)
        
        # Write to chain using single quotes to avoid PowerShell parsing
        $command = "cd /home/xchain && echo '$base64' | base64 -d > /tmp/args.json && ARGS=`$(cat /tmp/args.json) && ./bin/xchain-cli native invoke --method Set -a `"`$ARGS`" $contractName --fee 200 --keys $keysPath -H 127.0.0.1:$rpcPort --name $chainName"
        
        # Use sh -c with single quotes to avoid PowerShell escaping issues
        $result = docker exec $container sh -c $command 2>&1
        
        if ($result -match "Tx id:") {
            $txid = ($result | Select-String -Pattern "Tx id: ([a-f0-9]+)").Matches[0].Groups[1].Value
            Write-Host "[$($record.id)] Success - Tx: $txid" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "[$($record.id)] Failed: $result" -ForegroundColor Red
            $failCount++
        }
        
        # Small delay to avoid overwhelming the chain
        Start-Sleep -Milliseconds 300
    } catch {
        Write-Host "[$($record.id)] Error: $_" -ForegroundColor Red
        $failCount++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host "Total: $($successCount + $failCount)" -ForegroundColor Yellow

