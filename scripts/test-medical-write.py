#!/usr/bin/env python3
import json
import base64
import subprocess

# Test data
record = {
    "id": "MEDICAL20260101001",
    "medicalData": {
        "hospitalName": "Beijing General Hospital",
        "department": "Cardiology",
        "totalBeds": 118,
        "availableBeds": 99,
        "occupancyRate": 16.1,
        "latitude": 23.7306,
        "longitude": 80.7711,
        "address": "123 Medical Street, Beijing"
    },
    "qos": {
        "delay": 47,
        "availability": 96,
        "timestamp": "2026-01-01 13:32:49"
    }
}

key = "MEDICAL20260101001"
value_json = json.dumps(record)
args_obj = {"key": key, "value": value_json}
json_str = json.dumps(args_obj, separators=(',', ':'))
b64 = base64.b64encode(json_str.encode()).decode()

print(f"Base64: {b64}")
print("\nWriting...")
cmd = f'cd /home/xchain && echo "{b64}" | base64 -d > /tmp/test_args.json && ARGS=$(cat /tmp/test_args.json) && ./bin/xchain-cli native invoke --method Set -a "$ARGS" jsondata --fee 350 --keys data/keys -H 127.0.0.1:37104 --name subchain3'
result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/home/xchain')
print("STDOUT:")
print(result.stdout)
print("\nSTDERR:")
print(result.stderr)
print(f"\nReturn code: {result.returncode}")

print("\n\nQuerying...")
query_args = {"key": key}
query_json = json.dumps(query_args, separators=(',', ':'))
query_b64 = base64.b64encode(query_json.encode()).decode()
query_cmd = f'cd /home/xchain && echo "{query_b64}" | base64 -d > /tmp/query.json && ARGS=$(cat /tmp/query.json) && ./bin/xchain-cli native query --method Get -a "$ARGS" jsondata -H 127.0.0.1:37104 --name subchain3'
query_result = subprocess.run(query_cmd, shell=True, capture_output=True, text=True, cwd='/home/xchain')
print("STDOUT:")
print(query_result.stdout)
print("\nSTDERR:")
print(query_result.stderr)


