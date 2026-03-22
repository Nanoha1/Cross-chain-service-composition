# Write 30 health data records using Python in container
$jsonData = Get-Content -Path "health-data-30.json" -Raw | ConvertFrom-Json
$container = "xuperchain-sub1-node1"

$successCount = 0
$failCount = 0

Write-Host "Writing 30 health data records to subchain1..." -ForegroundColor Green

foreach ($record in $jsonData) {
    try {
        $key = $record.id
        
        # Convert record to JSON string
        $valueJson = $record | ConvertTo-Json -Compress -Depth 10
        
        # Create Python script to write data
        $pythonScript = @"
import json
import base64
import subprocess
import sys

key = '$key'
value_json = '''$valueJson'''

args_obj = {
    'key': key,
    'value': value_json
}

json_str = json.dumps(args_obj)
b64 = base64.b64encode(json_str.encode()).decode()

# Write base64 to file, then decode and write args
with open('/tmp/args_b64.txt', 'w') as f:
    f.write(b64)

# Execute command
cmd = 'cd /home/xchain && cat /tmp/args_b64.txt | base64 -d > /tmp/args.json && ARGS=$(cat /tmp/args.json) && ./bin/xchain-cli native invoke --method Set -a "$ARGS" jsondata --fee 200 --keys data/keys -H 127.0.0.1:37102 --name subchain1'
result = subprocess.run(cmd, shell=True, cwd='/home/xchain', capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print(result.stderr, file=sys.stderr)
sys.exit(result.returncode)
"@
        
        # Write Python script to container and execute
        $result = $pythonScript | docker exec -i $container sh -c 'cat > /tmp/write_one.py && python3 /tmp/write_one.py' 2>&1
        
        if ($LASTEXITCODE -eq 0 -and $result -match "Tx id:") {
            $txid = ($result | Select-String -Pattern "Tx id: ([a-f0-9]+)").Matches[0].Groups[1].Value
            Write-Host "[$key] ✓ Success - Tx: $txid" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "[$key] ✗ Failed" -ForegroundColor Red
            if ($result) {
                Write-Host "  Error: $($result -join ' ')" -ForegroundColor Yellow
            }
            $failCount++
        }
        
        Start-Sleep -Milliseconds 300
    } catch {
        Write-Host "[$($record.id)] ✗ Error: $_" -ForegroundColor Red
        $failCount++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red


