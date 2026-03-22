# Write 30 health data records to subchain1 using jsondata contract
# Following the method in README.md

$jsonData = Get-Content -Path "health-data-30.json" -Raw | ConvertFrom-Json
$container = "xuperchain-sub1-node1"
$rpcPort = 37102
$chainName = "subchain1"
$contractName = "jsondata"
$keysPath = "data/keys"

$successCount = 0
$failCount = 0

Write-Host "Writing 30 health data records to subchain1 using jsondata contract..." -ForegroundColor Green
Write-Host "Following README.md method: base64 encoding + temporary file" -ForegroundColor Cyan

foreach ($record in $jsonData) {
    try {
        $key = $record.id
        
        # Step 1: Convert record to JSON string (value field)
        $valueJson = $record | ConvertTo-Json -Compress -Depth 10
        
        # Step 2: Build args object: {"key":"...","value":"JSON字符串"}
        $argsObj = @{
            key = $key
            value = $valueJson
        } | ConvertTo-Json -Compress
        
        # Step 3: Base64 encode
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($argsObj)
        $base64 = [Convert]::ToBase64String($bytes)
        
        # Step 4: Write to chain (following README.md method)
        # Use single quotes to wrap the entire command to avoid PowerShell parsing
        $command = "cd /home/xchain && echo '$base64' | base64 -d > /tmp/args.json && ARGS=`$(cat /tmp/args.json) && ./bin/xchain-cli native invoke --method Set -a `"`$ARGS`" $contractName --fee 200 --keys $keysPath -H 127.0.0.1:$rpcPort --name $chainName"
        
        $result = docker exec $container sh -c $command 2>&1
        
        if ($result -match "Tx id:") {
            $txid = ($result | Select-String -Pattern "Tx id: ([a-f0-9]+)").Matches[0].Groups[1].Value
            Write-Host "[$key] ✓ Success - Tx: $txid" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "[$key] ✗ Failed" -ForegroundColor Red
            Write-Host "  Error: $result" -ForegroundColor Yellow
            $failCount++
        }
        
        # Small delay to avoid overwhelming the chain
        Start-Sleep -Milliseconds 300
    } catch {
        Write-Host "[$($record.id)] ✗ Error: $_" -ForegroundColor Red
        $failCount++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host "Total: $($successCount + $failCount)" -ForegroundColor Yellow


