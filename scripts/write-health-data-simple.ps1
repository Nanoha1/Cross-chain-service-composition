# Simple script to write health data using Python in container
$jsonData = Get-Content -Path "health-data-30.json" -Raw | ConvertFrom-Json
$container = "xuperchain-sub1-node1"

$successCount = 0
$failCount = 0

Write-Host "Writing 30 health data records to subchain1..." -ForegroundColor Green

foreach ($record in $jsonData) {
    try {
        # Convert record to JSON string and escape for Python
        $valueJson = $record | ConvertTo-Json -Compress -Depth 10
        $valueJsonEscaped = $valueJson -replace '"', '\"'
        
        $key = $record.id
        
        # Use Python in container to generate base64 and write
        $pythonScript = @"
import json
import base64
import subprocess
import sys

key = '$key'
value_json = '$valueJsonEscaped'

args_obj = {
    'key': key,
    'value': value_json
}

json_str = json.dumps(args_obj)
b64 = base64.b64encode(json_str.encode()).decode()

# Write to file
with open('/tmp/args.json', 'w') as f:
    f.write(json_str)

# Execute command
cmd = f'./bin/xchain-cli native invoke --method Set -a "$(cat /tmp/args.json)" jsondata --fee 200 --keys data/keys -H 127.0.0.1:37102 --name subchain1'
result = subprocess.run(cmd, shell=True, cwd='/home/xchain', capture_output=True, text=True)
print(result.stdout)
if result.stderr:
    print(result.stderr, file=sys.stderr)
"@
        
        # Write Python script to container and execute
        $pythonScript | docker exec -i $container sh -c 'cat > /tmp/write_data.py && python3 /tmp/write_data.py' 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$key] Success" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "[$key] Failed" -ForegroundColor Red
            $failCount++
        }
        
        Start-Sleep -Milliseconds 300
    } catch {
        Write-Host "[$($record.id)] Error: $_" -ForegroundColor Red
        $failCount++
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red


