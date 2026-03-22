FROM node:18-alpine

# 安装docker客户端（用于执行docker exec命令）
RUN apk add --no-cache docker-cli

WORKDIR /app

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制应用文件
COPY . .

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "server.js"]
