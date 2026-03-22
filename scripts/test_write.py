import json
import base64
import subprocess

# Test data
test_record = {
    "id": "TEST001",
    "healthData": {
        "name": "John",
        "heartRate": 75,
        "temperature": 36.5,
        "latitude": 39.9042,
        "longitude": 116.4074,
        "address": "123 Main St"
    },
    "qos": {
        "delay": 35,
        "availability": 98,
        "timestamp": "2025-12-31 22:00:00"
    }
}

# Build args
value_json = json.dumps(test_record)
args_obj = {"key": "TEST001", "value": value_json}
json_str = json.dumps(args_obj)
b64 = base64.b64encode(json_str.encode()).decode()

print("Base64:", b64)
print("Decoded:", json_str)

# Write and execute
cmd = f"cd /home/xchain && echo '{b64}' | base64 -d > /tmp/args.json && ARGS=$(cat /tmp/args.json) && ./bin/xchain-cli native invoke --method Set -a \"$ARGS\" jsondata --fee 200 --keys data/keys -H 127.0.0.1:37102 --name subchain1"
result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd="/home/xchain")
print("Return code:", result.returncode)
print("Stdout:", result.stdout)
print("Stderr:", result.stderr)


