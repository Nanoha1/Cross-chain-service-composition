#!/bin/bash
# 在容器启动时更新network.yaml中的bootNodes配置
# 通过Docker网络DNS解析其他节点IP

set -e

CONF_DIR="/home/xchain/conf"
NETWORK_YAML="$CONF_DIR/network.yaml"

if [ ! -f "$NETWORK_YAML" ]; then
    echo "network.yaml不存在，跳过配置更新"
    exit 0
fi

# 从环境变量获取当前节点信息
CURRENT_CONTAINER="${CONTAINER_NAME:-}"
CURRENT_CHAIN="${CHAIN_NAME:-}"
CURRENT_NODE="${NODE_NAME:-}"

if [ -z "$CURRENT_CONTAINER" ] || [ -z "$CURRENT_CHAIN" ] || [ -z "$CURRENT_NODE" ]; then
    echo "环境变量未设置，跳过网络配置更新"
    exit 0
fi

echo "更新网络配置: $CURRENT_CHAIN/$CURRENT_NODE"

# 定义节点映射（P2P端口和ID）
declare -A NODE_PORTS
declare -A NODE_IDS
declare -A SERVICE_NAMES

# 主链节点
if [ "$CURRENT_CHAIN" = "mainchain" ] || [ "$CURRENT_CHAIN" = "xuper" ]; then
    NODE_PORTS["node1"]=47101
    NODE_PORTS["node2"]=47111
    NODE_PORTS["node3"]=47121
    NODE_IDS["node1"]="Qmf2HeHe4sspGkfRCTq6257Vm3UHzvh2TeQJHHvHzzuFw6"
    NODE_IDS["node2"]="QmQKp8pLWSgV4JiGjuULKV1JsdpxUtnDEUMP8sGaaUbwVL"
    NODE_IDS["node3"]="QmZXjZibcL5hy2Ttv5CnAQnssvnCbPEGBzqk7sAnL69R1E"
    SERVICE_NAMES["node1"]="main-node1"
    SERVICE_NAMES["node2"]="main-node2"
    SERVICE_NAMES["node3"]="main-node3"
    CONTAINER_PREFIX="xuperchain-main-node"
elif [ "$CURRENT_CHAIN" = "subchain1" ]; then
    NODE_PORTS["node1"]=47102
    NODE_PORTS["node2"]=47112
    NODE_PORTS["node3"]=47122
    NODE_IDS["node1"]="Qmf2HeHe4sspGkfRCTq6257Vm3UHzvh2TeQJHHvHzzuFw6"
    NODE_IDS["node2"]="QmQKp8pLWSgV4JiGjuULKV1JsdpxUtnDEUMP8sGaaUbwVL"
    NODE_IDS["node3"]="QmZXjZibcL5hy2Ttv5CnAQnssvnCbPEGBzqk7sAnL69R1E"
    SERVICE_NAMES["node1"]="sub1-node1"
    SERVICE_NAMES["node2"]="sub1-node2"
    SERVICE_NAMES["node3"]="sub1-node3"
    CONTAINER_PREFIX="xuperchain-sub1-node"
elif [ "$CURRENT_CHAIN" = "subchain2" ]; then
    NODE_PORTS["node1"]=47103
    NODE_PORTS["node2"]=47113
    NODE_PORTS["node3"]=47123
    NODE_IDS["node1"]="Qmf2HeHe4sspGkfRCTq6257Vm3UHzvh2TeQJHHvHzzuFw6"
    NODE_IDS["node2"]="QmQKp8pLWSgV4JiGjuULKV1JsdpxUtnDEUMP8sGaaUbwVL"
    NODE_IDS["node3"]="QmZXjZibcL5hy2Ttv5CnAQnssvnCbPEGBzqk7sAnL69R1E"
    SERVICE_NAMES["node1"]="sub2-node1"
    SERVICE_NAMES["node2"]="sub2-node2"
    SERVICE_NAMES["node3"]="sub2-node3"
    CONTAINER_PREFIX="xuperchain-sub2-node"
elif [ "$CURRENT_CHAIN" = "subchain3" ]; then
    NODE_PORTS["node1"]=47104
    NODE_PORTS["node2"]=47114
    NODE_PORTS["node3"]=47124
    NODE_IDS["node1"]="Qmf2HeHe4sspGkfRCTq6257Vm3UHzvh2TeQJHHvHzzuFw6"
    NODE_IDS["node2"]="QmQKp8pLWSgV4JiGjuULKV1JsdpxUtnDEUMP8sGaaUbwVL"
    NODE_IDS["node3"]="QmZXjZibcL5hy2Ttv5CnAQnssvnCbPEGBzqk7sAnL69R1E"
    SERVICE_NAMES["node1"]="sub3-node1"
    SERVICE_NAMES["node2"]="sub3-node2"
    SERVICE_NAMES["node3"]="sub3-node3"
    CONTAINER_PREFIX="xuperchain-sub3-node"
else
    echo "未知链名: $CURRENT_CHAIN"
    exit 0
fi

# 生成bootNodes列表
BOOT_NODES_LIST=""
MAX_RETRIES=30
RETRY_DELAY=2

for NODE_NAME in node1 node2 node3; do
    if [ "$NODE_NAME" = "$CURRENT_NODE" ]; then
        continue
    fi
    
    OTHER_SERVICE="${SERVICE_NAMES[$NODE_NAME]}"
    OTHER_CONTAINER="${CONTAINER_PREFIX}${NODE_NAME#node}"
    P2P_PORT="${NODE_PORTS[$NODE_NAME]}"
    P2P_ID="${NODE_IDS[$NODE_NAME]}"
    
    # 尝试获取其他节点的IP地址
    CONTAINER_IP=""
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        # 方式1: 使用服务名称（Docker Compose网络DNS）
        if command -v getent >/dev/null 2>&1; then
            CONTAINER_IP=$(getent hosts $OTHER_SERVICE 2>/dev/null | awk '{print $1}' | head -n1)
        fi
        
        # 方式2: 使用ping获取IP（通过服务名称）
        if [ -z "$CONTAINER_IP" ]; then
            CONTAINER_IP=$(ping -c 1 -W 1 $OTHER_SERVICE 2>/dev/null | grep -oP '(\d+\.){3}\d+' | head -n1 || echo "")
        fi
        
        # 方式3: 尝试容器名称
        if [ -z "$CONTAINER_IP" ] && command -v getent >/dev/null 2>&1; then
            CONTAINER_IP=$(getent hosts $OTHER_CONTAINER 2>/dev/null | awk '{print $1}' | head -n1)
        fi
        
        if [ -n "$CONTAINER_IP" ]; then
            break
        fi
        
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            echo "等待节点 $OTHER_SERVICE ($OTHER_CONTAINER) 启动... ($RETRY_COUNT/$MAX_RETRIES)"
            sleep $RETRY_DELAY
        fi
    done
    
    if [ -z "$CONTAINER_IP" ]; then
        echo "警告: 无法获取节点 $OTHER_SERVICE ($OTHER_CONTAINER) 的IP地址，跳过"
        continue
    fi
    
    echo "找到节点: $OTHER_SERVICE ($OTHER_CONTAINER) -> $CONTAINER_IP:$P2P_PORT"
    
    BOOT_NODE="/ip4/$CONTAINER_IP/tcp/$P2P_PORT/p2p/$P2P_ID"
    if [ -z "$BOOT_NODES_LIST" ]; then
        BOOT_NODES_LIST="  - \"$BOOT_NODE\""
    else
        BOOT_NODES_LIST="$BOOT_NODES_LIST"$'\n'"  - \"$BOOT_NODE\""
    fi
done

if [ -z "$BOOT_NODES_LIST" ]; then
    echo "没有找到其他节点，使用空bootNodes配置"
    # 如果node1没有其他节点，可以启动；其他节点需要等待
    if [ "$CURRENT_NODE" != "node1" ]; then
        echo "错误: node2/node3需要连接到其他节点，但未找到"
        exit 1
    fi
fi

# 更新network.yaml
cp "$NETWORK_YAML" "$NETWORK_YAML.bak"

# 使用Python更新YAML（如果可用），否则使用sed
if command -v python3 >/dev/null 2>&1; then
    python3 - "$NETWORK_YAML" "$BOOT_NODES_LIST" << 'PYEOF'
import re
import sys

network_yaml = sys.argv[1]
boot_nodes_list = sys.argv[2]

with open(network_yaml + ".bak", "r") as f:
    content = f.read()

# 更新bootNodes配置
if re.search(r'^bootNodes:', content, re.MULTILINE):
    # 替换现有bootNodes（从bootNodes:到下一个非注释非空行）
    pattern = r'^bootNodes:.*?(?=\n[^#\s#]|\Z)'
    replacement = 'bootNodes:\n' + boot_nodes_list + '\n'
    content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
else:
    # 添加bootNodes
    content = re.sub(
        r'(keyPath: netkeys)',
        r'\1\n\n# BootNodes config the bootNodes the node to connect\nbootNodes:\n' + boot_nodes_list + '\n',
        content
    )

with open(network_yaml, "w") as f:
    f.write(content)
PYEOF
else
    # 使用sed更新（简单替换）
    if grep -q "^bootNodes:" "$NETWORK_YAML.bak"; then
        # 删除现有bootNodes配置（从bootNodes:到下一个非注释非空行）
        awk -v new_bootnodes="$BOOT_NODES_LIST" '
            /^bootNodes:/ {
                print
                print new_bootnodes
                skip=1
                next
            }
            skip && /^[^[:space:]#]/ {
                skip=0
            }
            !skip {
                print
            }
        ' "$NETWORK_YAML.bak" > "$NETWORK_YAML"
    else
        # 添加bootNodes配置
        sed -i "/^keyPath: netkeys/a\\\n# BootNodes config the bootNodes the node to connect\nbootNodes:\n$BOOT_NODES_LIST\n" "$NETWORK_YAML.bak"
        mv "$NETWORK_YAML.bak" "$NETWORK_YAML"
    fi
fi

echo "network.yaml已更新"
if [ -n "$BOOT_NODES_LIST" ]; then
    echo "bootNodes配置:"
    echo "$BOOT_NODES_LIST"
fi

