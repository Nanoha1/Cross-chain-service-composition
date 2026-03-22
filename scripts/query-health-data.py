#!/usr/bin/env python3
import json
import base64
import subprocess

# Read health data to get IDs
with open('/tmp/health-data-30.json', 'r', encoding='utf-8-sig') as f:
    records = json.load(f)

# Query first 5 records
print("Querying first 5 records...\n")

for i in range(5):
    key = records[i]['id']
    
    # Build query args (match write format - with spaces from json.dumps default)
    query_args = {"key": key}
    # Use default json.dumps format (with spaces) to match write format
    json_str = json.dumps(query_args)
    b64 = base64.b64encode(json_str.encode()).decode()
    
    # Query
    cmd = f'cd /home/xchain && echo "{b64}" | base64 -d > /tmp/query.json && ARGS=$(cat /tmp/query.json) && ./bin/xchain-cli native query --method Get -a "$ARGS" jsondata -H 127.0.0.1:37102 --name subchain1'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd="/home/xchain")
    
    if result.returncode == 0 and "contract response:" in result.stdout:
        print(f"[{key}] ✓ Found")
        # Extract JSON from response
        response_line = [line for line in result.stdout.split('\n') if 'contract response:' in line][0]
        json_data = response_line.split('contract response:')[1].strip()
        data = json.loads(json_data)
        print(f"  Name: {data['healthData']['name']}")
        print(f"  Heart Rate: {data['healthData']['heartRate']}")
        print(f"  Temperature: {data['healthData']['temperature']}")
        if data['healthData']['heartRate'] < 60 or data['healthData']['heartRate'] > 100:
            print(f"  ⚠ ABNORMAL: Heart rate out of normal range!")
        if data['healthData']['temperature'] < 36.0 or data['healthData']['temperature'] > 37.5:
            print(f"  ⚠ ABNORMAL: Temperature out of normal range!")
        print()
    else:
        print(f"[{key}] ✗ Not found")
        if result.stderr:
            print(f"  Error: {result.stderr.strip()}")
        print()


