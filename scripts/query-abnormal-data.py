#!/usr/bin/env python3
import json
import base64
import subprocess

with open('/tmp/health-data-30.json', 'r', encoding='utf-8-sig') as f:
    records = json.load(f)

# Abnormal record indices (0-based): 2, 6, 11, 17, 24
abnormal_indices = [2, 6, 11, 17, 24]

print("Querying abnormal health data records:\n")
print("=" * 60)

for idx in abnormal_indices:
    key = records[idx]['id']
    query_args = {"key": key}
    json_str = json.dumps(query_args)
    b64 = base64.b64encode(json_str.encode()).decode()
    
    cmd = f'cd /home/xchain && echo "{b64}" | base64 -d > /tmp/query.json && ARGS=$(cat /tmp/query.json) && ./bin/xchain-cli native query --method Get -a "$ARGS" jsondata -H 127.0.0.1:37102 --name subchain1'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd="/home/xchain")
    
    if result.returncode == 0 and "contract response:" in result.stdout:
        response_line = [line for line in result.stdout.split('\n') if 'contract response:' in line][0]
        json_data = response_line.split('contract response:')[1].strip()
        data = json.loads(json_data)
        
        hd = data['healthData']
        print(f"\n[{key}] {hd['name']}")
        print(f"  Heart Rate: {hd['heartRate']} bpm (normal: 60-100)")
        print(f"  Temperature: {hd['temperature']}°C (normal: 36.0-37.5°C)")
        print(f"  Location: {hd['address']}")
        print(f"  Coordinates: ({hd['latitude']}, {hd['longitude']})")
        
        # Check abnormalities
        abnormalities = []
        if hd['heartRate'] < 60:
            abnormalities.append(f"Bradycardia (HR: {hd['heartRate']} < 60)")
        elif hd['heartRate'] > 100:
            abnormalities.append(f"Tachycardia (HR: {hd['heartRate']} > 100)")
        if hd['temperature'] < 36.0:
            abnormalities.append(f"Hypothermia (Temp: {hd['temperature']} < 36.0°C)")
        elif hd['temperature'] > 37.5:
            abnormalities.append(f"Fever (Temp: {hd['temperature']} > 37.5°C)")
        if hd['latitude'] > 90 or hd['longitude'] > 180:
            abnormalities.append(f"Invalid coordinates (Lat: {hd['latitude']}, Lon: {hd['longitude']})")
        
        if abnormalities:
            print(f"  ⚠ ABNORMAL:")
            for ab in abnormalities:
                print(f"    - {ab}")

print("\n" + "=" * 60)
print(f"\nTotal abnormal records queried: {len(abnormal_indices)}")


