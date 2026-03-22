#!/usr/bin/env python3
import json
import base64
import subprocess
import sys
import time

# Read health data
with open('/tmp/health-data-30.json', 'r', encoding='utf-8-sig') as f:
    records = json.load(f)

container = "xuperchain-sub1-node1"
rpc_port = 37102
chain_name = "subchain1"
contract_name = "jsondata"
keys_path = "data/keys"

success_count = 0
fail_count = 0

print("Writing 30 health data records to subchain1...")
print("Following README.md method: base64 encoding + temporary file\n")

for record in records:
    try:
        key = record['id']
        
        # Convert record to JSON string (value field)
        value_json = json.dumps(record)
        
        # Build args object: {"key":"...","value":"JSON字符串"}
        args_obj = {
            "key": key,
            "value": value_json
        }
        
        # Base64 encode (use separators to match query format)
        json_str = json.dumps(args_obj, separators=(',', ':'))
        b64 = base64.b64encode(json_str.encode()).decode()
        
        # Write to chain directly (we're already in the container)
        # Following README.md method: echo base64 | base64 -d > /tmp/args.json
        cmd = f'cd /home/xchain && echo "{b64}" | base64 -d > /tmp/args.json && ARGS=$(cat /tmp/args.json) && ./bin/xchain-cli native invoke --method Set -a "$ARGS" {contract_name} --fee 300 --keys {keys_path} -H 127.0.0.1:{rpc_port} --name {chain_name}'
        
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd='/home/xchain')
        
        if result.returncode == 0 and "Tx id:" in result.stdout:
            txid = None
            for line in result.stdout.split('\n'):
                if "Tx id:" in line:
                    txid = line.split("Tx id:")[1].strip()
                    break
            print(f"[{key}] ✓ Success - Tx: {txid}")
            success_count += 1
        else:
            print(f"[{key}] ✗ Failed (returncode: {result.returncode})")
            if result.stdout:
                print(f"  stdout: {result.stdout.strip()[:200]}")
            if result.stderr:
                print(f"  stderr: {result.stderr.strip()[:200]}")
            fail_count += 1
        
        # Small delay
        time.sleep(0.3)
    except Exception as e:
        print(f"[{record.get('id', 'unknown')}] ✗ Error: {e}")
        fail_count += 1

print(f"\n=== Summary ===")
print(f"Success: {success_count}")
print(f"Failed: {fail_count}")
print(f"Total: {success_count + fail_count}")

