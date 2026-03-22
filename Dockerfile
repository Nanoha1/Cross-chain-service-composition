FROM golang:1.20 AS builder
WORKDIR /home/xchain

RUN apt-get update && apt-get install -y unzip build-essential git

# 配置Go代理
ENV GOPROXY=https://goproxy.cn,direct
ENV GO111MODULE=on
ENV X_ROOT_PATH=/home/xchain

# 复制依赖文件
COPY xuperchain/go.* ./
COPY xuperchain/Makefile ./
RUN make prepare

# 复制源代码并编译
COPY xuperchain/ .

# 修复Windows换行符问题
RUN find . -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;

RUN make

# 运行阶段
FROM ubuntu:22.04
WORKDIR /home/xchain

# 设置非交互式环境变量，避免tzdata等包的交互式提示
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Shanghai

RUN apt-get update && apt-get install -y build-essential bash iputils-ping dnsutils python3 tzdata && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制输出
COPY --from=builder /home/xchain/output .

# 复制网络配置更新脚本
COPY scripts/update-network-config.sh /home/xchain/update-network-config.sh
RUN chmod +x /home/xchain/update-network-config.sh

# 创建启动脚本
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# 更新网络配置（如果环境变量已设置）\n\
if [ -n "$CONTAINER_NAME" ] && [ -n "$CHAIN_NAME" ] && [ -n "$NODE_NAME" ]; then\n\
    echo "更新网络配置..."\n\
    /home/xchain/update-network-config.sh || echo "网络配置更新失败，继续启动"\n\
fi\n\
\n\
# 启动xchain\n\
cd /home/xchain\n\
exec bash control.sh start -f\n\
' > /home/xchain/entrypoint.sh && chmod +x /home/xchain/entrypoint.sh

# 暴露端口
EXPOSE 37101-37104 47101-47104 37301-37304

# 使用entrypoint脚本
ENTRYPOINT ["/home/xchain/entrypoint.sh"]

