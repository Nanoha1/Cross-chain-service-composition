const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const cors = require('cors');
const path = require('path');
const XuperChainClient = require('./xuperchain-client');
const TxBuilder = require('./tx-builder');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json()); // 全局配置JSON解析中间件
app.use(express.urlencoded({ extended: true })); // 支持URL编码

// API路由必须在静态文件服务之前
// 查询链状态的API
app.get('/api/status/:container', async (req, res) => {
    const { container } = req.params;
    const port = req.query.port || 37101;

    try {
        // 通过docker exec执行xchain-cli命令
        const command = `docker exec ${container} ./bin/xchain-cli status -H 127.0.0.1:${port}`;
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr && !stdout) {
            return res.status(500).json({ error: stderr });
        }

        try {
            const data = JSON.parse(stdout);
            res.json(data);
        } catch (parseError) {
            res.status(500).json({ error: '解析响应失败', raw: stdout });
        }
    } catch (error) {
        res.status(500).json({ 
            error: '查询失败', 
            message: error.message,
            container: container,
            port: port
        });
    }
});

// 获取所有节点信息
app.get('/api/nodes', async (req, res) => {
    try {
        // 获取所有运行中的xuperchain容器
        const { stdout } = await execAsync('docker ps --format "{{.Names}}" --filter "name=xuperchain"');
        const containers = stdout.trim().split('\n').filter(c => c);
        
        // 节点配置（单节点和多节点）
        const nodeConfigs = [
            // 单节点架构
            { name: 'Main Chain-Node 1', chain: 'xuper', container: 'xuperchain-main-node1', rpc: 37101, p2p: 47101, gw: 37301 },
            { name: 'Main Chain-Node 2', chain: 'xuper', container: 'xuperchain-main-node2', rpc: 37111, p2p: 47111, gw: 37311 },
            { name: 'Main Chain-Node 3', chain: 'xuper', container: 'xuperchain-main-node3', rpc: 37121, p2p: 47121, gw: 37321 },
            { name: 'SubChain 1-Node 1', chain: 'subchain1', container: 'xuperchain-sub1-node1', rpc: 37102, p2p: 47102, gw: 37302 },
            { name: 'SubChain 1-Node 2', chain: 'subchain1', container: 'xuperchain-sub1-node2', rpc: 37112, p2p: 47112, gw: 37312 },
            { name: 'SubChain 1-Node 3', chain: 'subchain1', container: 'xuperchain-sub1-node3', rpc: 37122, p2p: 47122, gw: 37322 },
            { name: 'SubChain 2-Node 1', chain: 'subchain2', container: 'xuperchain-sub2-node1', rpc: 37103, p2p: 47103, gw: 37303 },
            { name: 'SubChain 2-Node 2', chain: 'subchain2', container: 'xuperchain-sub2-node2', rpc: 37113, p2p: 47113, gw: 37313 },
            { name: 'SubChain 2-Node 3', chain: 'subchain2', container: 'xuperchain-sub2-node3', rpc: 37123, p2p: 47123, gw: 37323 },
            { name: 'SubChain 3-Node 1', chain: 'subchain3', container: 'xuperchain-sub3-node1', rpc: 37104, p2p: 47104, gw: 37304 },
            { name: 'SubChain 3-Node 2', chain: 'subchain3', container: 'xuperchain-sub3-node2', rpc: 37114, p2p: 47114, gw: 37314 },
            { name: 'SubChain 3-Node 3', chain: 'subchain3', container: 'xuperchain-sub3-node3', rpc: 37124, p2p: 47124, gw: 37324 },
            // Multi-node architecture - Main Chain
            { name: 'Main Chain-Node 1', chain: 'xuper', container: 'xuperchain-main-node1', rpc: 37101, p2p: 47101, gw: 37301 },
            { name: 'Main Chain-Node 2', chain: 'xuper', container: 'xuperchain-main-node2', rpc: 37111, p2p: 47111, gw: 37311 },
            { name: 'Main Chain-Node 3', chain: 'xuper', container: 'xuperchain-main-node3', rpc: 37121, p2p: 47121, gw: 37321 },
            // Multi-node architecture - SubChain 1
            { name: 'SubChain 1-Node 1', chain: 'subchain1', container: 'xuperchain-sub1-node1', rpc: 37102, p2p: 47102, gw: 37302 },
            { name: 'SubChain 1-Node 2', chain: 'subchain1', container: 'xuperchain-sub1-node2', rpc: 37112, p2p: 47112, gw: 37312 },
            { name: 'SubChain 1-Node 3', chain: 'subchain1', container: 'xuperchain-sub1-node3', rpc: 37122, p2p: 47122, gw: 37322 },
            // Multi-node architecture - SubChain 2
            { name: 'SubChain 2-Node 1', chain: 'subchain2', container: 'xuperchain-sub2-node1', rpc: 37103, p2p: 47103, gw: 37303 },
            { name: 'SubChain 2-Node 2', chain: 'subchain2', container: 'xuperchain-sub2-node2', rpc: 37113, p2p: 47113, gw: 37313 },
            { name: 'SubChain 2-Node 3', chain: 'subchain2', container: 'xuperchain-sub2-node3', rpc: 37123, p2p: 47123, gw: 37323 },
            // Multi-node architecture - SubChain 3
            { name: 'SubChain 3-Node 1', chain: 'subchain3', container: 'xuperchain-sub3-node1', rpc: 37104, p2p: 47104, gw: 37304 },
            { name: 'SubChain 3-Node 2', chain: 'subchain3', container: 'xuperchain-sub3-node2', rpc: 37114, p2p: 47114, gw: 37314 },
            { name: 'SubChain 3-Node 3', chain: 'subchain3', container: 'xuperchain-sub3-node3', rpc: 37124, p2p: 47124, gw: 37324 },
        ];
        
        // 查询每个节点的状态
        const nodes = await Promise.all(nodeConfigs.map(async (config) => {
            const isRunning = containers.includes(config.container);
            let status = 'Offline';
            let height = '-';
            let tipBlockid = '-';
            let lastUpdate = null;
            
            if (isRunning) {
                try {
                    const command = `docker exec ${config.container} ./bin/xchain-cli status -H 127.0.0.1:${config.rpc}`;
                    const { stdout } = await execAsync(command, { timeout: 5000 });
                    const data = JSON.parse(stdout);
                    
                    if (data && data.blockchains && data.blockchains.length > 0) {
                        const chain = data.blockchains[0];
                        status = 'Running';
                        height = chain.ledger?.trunkHeight || 0;
                        tipBlockid = chain.ledger?.tipBlockid || '-';
                        lastUpdate = new Date().toISOString();
                    }
                } catch (error) {
                    status = 'Error';
                    console.error(`Query node ${config.container} failed:`, error.message);
                }
            }
            
            return {
                name: config.name,
                chain: config.chain,
                container: config.container,
                rpcPort: config.rpc,
                p2pPort: config.p2p,
                gwPort: config.gw,
                status: status,
                height: height,
                tipBlockid: tipBlockid,
                lastUpdate: lastUpdate,
                isRunning: isRunning
            };
        }));
        
        // 只返回实际运行的节点
        const activeNodes = nodes.filter(n => n.isRunning);
        
        res.json({
            total: activeNodes.length,
            nodes: activeNodes
        });
    } catch (error) {
        res.status(500).json({ 
            error: '获取节点信息失败', 
            message: error.message 
        });
    }
});

// 创建账户
app.post('/api/account/create', async (req, res) => {
    const { accountName, chain, container, rpcPort } = req.body;
    
    try {
        // 在容器内创建账户
        const keysPath = `data/${accountName}`;
        const command = `docker exec ${container} ./bin/xchain-cli account newkeys --output ${keysPath}`;
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr && !stdout) {
            return res.status(500).json({ error: stderr });
        }
        
        // 读取生成的地址
        const readAddressCmd = `docker exec ${container} cat ${keysPath}/address`;
        const { stdout: address } = await execAsync(readAddressCmd);
        const addressStr = address.trim();
        
        // 给新账户转账初始余额（从默认账户转账）
        try {
            const transferCmd = `docker exec ${container} ./bin/xchain-cli transfer --to ${addressStr} --amount 10000000 --keys data/keys -H 127.0.0.1:${rpcPort}`;
            await execAsync(transferCmd);
        } catch (transferError) {
            console.warn('转账失败，但账户已创建:', transferError.message);
            // 继续执行，账户已创建成功
        }
        
        res.json({
            success: true,
            address: addressStr,
            accountName: accountName,
            chain: chain
        });
    } catch (error) {
        console.error('创建账户失败:', error);
        res.status(500).json({ 
            error: '创建账户失败', 
            message: error.message 
        });
    }
});

// 扫描容器内已存在的账户
app.post('/api/account/scan', async (req, res) => {
    const { chain, container, rpcPort } = req.body;
    
    try {
        // 扫描data目录下的所有包含address文件的目录
        const scanCmd = `docker exec ${container} sh -c "find data -type f -name address 2>/dev/null | sed 's|/address$||' | grep -v '^data$' | sort -u"`;
        const { stdout } = await execAsync(scanCmd);
        
        const accountDirs = stdout.trim().split('\n').filter(dir => dir && dir.startsWith('data/'));
        const accounts = [];
        
        for (const dir of accountDirs) {
            try {
                const addressCmd = `docker exec ${container} cat ${dir}/address 2>/dev/null`;
                const { stdout: address } = await execAsync(addressCmd);
                const addressStr = address.trim();
                
                if (addressStr && addressStr.length > 0) {
                    // 从路径提取账户名称（data/alice -> alice）
                    const pathParts = dir.replace('data/', '').split('/');
                    const accountName = pathParts[0] || 'unknown';
                    
                    accounts.push({
                        name: accountName,
                        address: addressStr,
                        keysPath: dir,
                        chain: chain
                    });
                }
            } catch (err) {
                // 忽略无法读取的目录
                continue;
            }
        }
        
        res.json({
            success: true,
            accounts: accounts
        });
    } catch (error) {
        console.error('扫描账户失败:', error);
        res.status(500).json({ 
            error: '扫描账户失败', 
            message: error.message 
        });
    }
});

// 检查密钥路径是否存在
app.post('/api/account/check-keys', async (req, res) => {
    const { container, keysPath } = req.body;
    
    try {
        const checkKeysCmd = `docker exec ${container} test -d ${keysPath} && echo "exists" || echo "not exists"`;
        const { stdout: keysCheck } = await execAsync(checkKeysCmd);
        
        res.json({
            success: true,
            exists: keysCheck.trim() === 'exists',
            keysPath: keysPath,
            container: container
        });
    } catch (error) {
        console.error('检查密钥路径失败:', error);
        res.status(500).json({ 
            error: '检查密钥路径失败', 
            message: error.message,
            exists: false
        });
    }
});

// 查询账户余额（使用HTTP API）
app.post('/api/account/balance', async (req, res) => {
    const { address, chain, container, rpcPort } = req.body;
    
    try {
        // 在Docker网络中，直接使用容器名访问Gateway
        // Gateway端口在容器内部是固定的（37301, 37302等），与RPC端口对应
        const gwPort = rpcPort + 200; // 容器内部Gateway端口
        const gatewayHost = container; // 使用容器名，在Docker网络中可以直接访问
        const client = new XuperChainClient(`http://${gatewayHost}:${gwPort}`);
        
        const balance = await client.getBalance(address, chain);
        
        // 调试日志
        console.log(`查询余额 - 地址: ${address}, 链: ${chain}, 结果: ${balance}`);
        
        res.json({
            success: true,
            balance: balance,
            address: address
        });
    } catch (error) {
        console.error('查询余额失败:', error);
        res.status(500).json({ 
            error: '查询余额失败', 
            message: error.message 
        });
    }
});

// 写入数据到链上（通过合约）
app.post('/api/data/write', async (req, res) => {
    const { key, value, dataType, contractName, address, chain, container, rpcPort, keysPath } = req.body;
    
    try {
        // 首先检查账户余额和keysPath是否存在
        let balance = '0';
        try {
            // 检查keysPath是否存在
            const checkKeysCmd = `docker exec ${container} test -d ${keysPath} && echo "exists" || echo "not exists"`;
            const { stdout: keysCheck } = await execAsync(checkKeysCmd);
            
            if (keysCheck.trim() === 'not exists') {
                return res.status(400).json({ 
                    error: '账户密钥路径不存在',
                    message: `密钥路径 ${keysPath} 不存在。请确认账户已正确创建。`,
                    keysPath: keysPath,
                    hint: `请检查账户是否正确创建，或使用默认账户路径 data/keys`
                });
            }
            
            const balanceCmd = `docker exec ${container} ./bin/xchain-cli account balance --keys ${keysPath} -H 127.0.0.1:${rpcPort} --name ${chain}`;
            const { stdout: balanceStdout } = await execAsync(balanceCmd);
            balance = balanceStdout.trim();
            
            // 检查余额是否足够（至少需要1000，因为fee是100）
            const balanceNum = BigInt(balance);
            if (balanceNum < BigInt(1000)) {
                return res.status(400).json({ 
                    error: '余额不足',
                    message: `账户余额不足。当前余额: ${balance}，至少需要 1000 来支付手续费。`,
                    balance: balance,
                    hint: `请先给账户转账。可以使用以下命令：\n` +
                          `docker exec ${container} ./bin/xchain-cli transfer --to ${address} --amount 1000000 --keys data/keys -H 127.0.0.1:${rpcPort}`
                });
            }
        } catch (balanceError) {
            console.error('查询余额失败:', balanceError);
            // 继续执行，不阻止交易
        }
        
        // 使用TxBuilder调用合约（混合方案：使用xchain-cli签名，但通过HTTP API提交）
        // 构建参数（counter合约只需要key）
        const argsObj = { key: key };
        
        try {
            const result = await TxBuilder.invokeContract(
                container,
                keysPath,
                contractName,
                'Increase',
                argsObj,
                '100',
                chain,
                rpcPort
            );
            
            if (!result.txid) {
                return res.status(500).json({ 
                    error: '交易失败',
                    message: '未能获取交易ID',
                    stdout: result.stdout
                });
            }
            
            res.json({
                success: true,
                txid: result.txid,
                response: result.response,
                method: 'Increase',
                balance: balance,
                note: '当前使用counter合约的Increase方法。如需存储自定义数据，请部署支持SetData方法的合约。'
            });
        } catch (invokeError) {
            console.error('调用合约失败:', invokeError);
            
            // 检查错误类型
            const errorMsg = invokeError.message || invokeError.toString();
            
            if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
                return res.status(404).json({ 
                    error: '合约不存在',
                    message: `合约 ${contractName} 未部署。请先部署合约。`,
                    hint: '可以使用以下命令部署counter合约：\n' +
                          `docker exec ${container} bash -c './bin/xchain-cli native deploy --account XC1111111111111111@${chain} --runtime go --cname ${contractName} counter --fee 15587517 -H 127.0.0.1:${rpcPort}'`
                });
            }
            
            if (errorMsg.includes('insufficient') || errorMsg.includes('balance') || errorMsg.includes('余额')) {
                return res.status(400).json({ 
                    error: '余额不足',
                    message: `账户余额不足，无法支付手续费。`,
                    balance: balance,
                    hint: `请先给账户转账。可以使用以下命令：\n` +
                          `docker exec ${container} ./bin/xchain-cli transfer --to ${address} --amount 1000000 --keys data/keys -H 127.0.0.1:${rpcPort}`
                });
            }
            
            return res.status(500).json({ 
                error: '调用合约失败', 
                message: errorMsg,
                details: { keysPath, contractName, address }
            });
        }
    } catch (error) {
        console.error('写入数据失败:', error);
        res.status(500).json({ 
            error: '写入数据失败', 
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 查询链上数据（使用HTTP API）
app.post('/api/data/query', async (req, res) => {
    const { key, contractName, chain, container, rpcPort, keysPath } = req.body;
    
    try {
        // 在Docker网络中，直接使用容器名访问Gateway
        // Gateway端口在容器内部是固定的（37301, 37302等），与RPC端口对应
        const gwPort = rpcPort + 200; // 容器内部Gateway端口
        const gatewayHost = container; // 使用容器名，在Docker网络中可以直接访问
        const client = new XuperChainClient(`http://${gatewayHost}:${gwPort}`);
        
        // 构建查询参数
        const args = { key: key };
        
        // 读取initiator地址（从keysPath读取，如果没有则使用默认地址）
        let initiator = 'TeyyPLpp9L7QAcxHangtcHTu7HUZ6iydY'; // 默认地址
        if (keysPath) {
            try {
                const readAddressCmd = `docker exec ${container} cat ${keysPath}/address`;
                const { stdout: address } = await execAsync(readAddressCmd);
                initiator = address.trim();
            } catch (e) {
                console.warn('读取地址失败，使用默认地址:', e.message);
            }
        } else {
            // 如果没有keysPath，尝试使用data/keys
            try {
                const readAddressCmd = `docker exec ${container} cat data/keys/address`;
                const { stdout: address } = await execAsync(readAddressCmd);
                initiator = address.trim();
            } catch (e) {
                console.warn('读取默认地址失败，使用硬编码地址:', e.message);
            }
        }
        
        // 构建合约调用请求
        const request = client.buildInvokeRequest('native', contractName, 'Get', args);
        
        // 使用preExec进行查询
        const response = await client.preExec(chain, [request], initiator);
        
        // 解析响应 - Gateway API返回格式: response.response.responses[0].body (base64编码)
        let responseStr = null;
        
        if (response && response.response && response.response.responses && response.response.responses.length > 0) {
            const contractResponse = response.response.responses[0];
            
            // body字段是base64编码的响应数据
            if (contractResponse.body) {
                try {
                    responseStr = Buffer.from(contractResponse.body, 'base64').toString('utf-8');
                } catch (e) {
                    console.warn(`查询 ${key} base64解码失败:`, e);
                }
            }
        }
        
        if (responseStr) {
            res.json({
                success: true,
                key: key,
                value: responseStr,
                contractName: contractName
            });
        } else {
            // 如果没有找到数据，返回空值（可能是key不存在）
            res.json({
                success: true,
                key: key,
                value: '',
                contractName: contractName
            });
        }
    } catch (error) {
        console.error('查询数据失败:', error);
        res.status(500).json({ 
            error: '查询数据失败', 
            message: error.message 
        });
    }
});

// 上传JSON数据到链上（使用jsondata合约）
app.post('/api/data/upload-json', async (req, res) => {
    const { key, value, address, chain, container, rpcPort, keysPath } = req.body;
    
    try {
        // 验证参数
        if (!key || !value) {
            return res.status(400).json({
                error: 'Missing parameters',
                message: 'key and value are required'
            });
        }
        
        // 验证value是有效的JSON
        try {
            JSON.parse(value);
        } catch (e) {
            return res.status(400).json({
                error: 'Invalid JSON',
                message: 'value must be a valid JSON string'
            });
        }
        
        // 检查keysPath是否存在
        try {
            const checkKeysCmd = `docker exec ${container} test -d ${keysPath} && echo "exists" || echo "not exists"`;
            const { stdout: keysCheck } = await execAsync(checkKeysCmd);
            
            if (keysCheck.trim() === 'not exists') {
                return res.status(400).json({
                    error: 'Account keys path not found',
                    message: `Keys path ${keysPath} does not exist. Please create an account first.`
                });
            }
        } catch (checkError) {
            console.warn('Check keys path failed:', checkError);
        }
        
        // 构建参数对象：{"key":"数据ID","value":"JSON字符串"}
        const argsObj = {
            key: key,
            value: value
        };
        
        // 使用TxBuilder调用jsondata合约的Set方法
        const result = await TxBuilder.invokeContract(
            container,
            keysPath,
            'jsondata',
            'Set',
            argsObj,
            '400', // 手续费设置为400（gas消耗约243-300，400更安全）
            chain,
            rpcPort
        );
        
        if (!result.txid) {
            return res.status(500).json({
                error: 'Transaction failed',
                message: 'Failed to get transaction ID',
                stdout: result.stdout,
                stderr: result.stderr
            });
        }
        
        res.json({
            success: true,
            txid: result.txid,
            response: result.response,
            method: 'Set',
            contract: 'jsondata',
            key: key
        });
    } catch (error) {
        console.error('Upload JSON data failed:', error);
        
        const errorMsg = error.message || error.toString();
        
        if (errorMsg.includes('not found') || errorMsg.includes('does not exist')) {
            return res.status(404).json({
                error: 'Contract not found',
                message: 'jsondata contract is not deployed on this chain',
                hint: 'Please deploy jsondata contract first. See README.md for deployment instructions.'
            });
        }
        
        if (errorMsg.includes('insufficient') || errorMsg.includes('balance') || errorMsg.includes('余额')) {
            return res.status(400).json({
                error: 'Insufficient balance',
                message: 'Account balance is insufficient to pay transaction fee',
                hint: 'Please transfer funds to the account first'
            });
        }
        
        res.status(500).json({
            error: 'Upload failed',
            message: errorMsg
        });
    }
});

// 获取链上的合约列表
app.post('/api/contracts/list', async (req, res) => {
    const { chain, container, rpcPort } = req.body;
    
    try {
        // 使用默认账户查询合约列表
        const accountName = 'XC1111111111111111@' + chain;
        const cmd = `docker exec ${container} ./bin/xchain-cli account contracts --account ${accountName} -H 127.0.0.1:${rpcPort} --name ${chain}`;
        const { stdout, stderr } = await execAsync(cmd);
        
        if (stderr && !stdout) {
            // 如果查询失败，返回默认合约列表
            return res.json({
                success: true,
                contracts: [
                    { contract_name: 'jsondata' },
                    { contract_name: 'golangcounter' },
                    { contract_name: 'datastore' }
                ]
            });
        }
        
        try {
            const contracts = JSON.parse(stdout);
            // 确保返回的是数组格式
            const contractList = Array.isArray(contracts) ? contracts : [];
            
            res.json({
                success: true,
                contracts: contractList
            });
        } catch (parseError) {
            // 解析失败，返回默认合约列表
            console.warn('Failed to parse contracts list:', parseError);
            res.json({
                success: true,
                contracts: [
                    { contract_name: 'jsondata' },
                    { contract_name: 'golangcounter' },
                    { contract_name: 'datastore' }
                ]
            });
        }
    } catch (error) {
        console.error('获取合约列表失败:', error);
        // 即使失败也返回默认合约列表
        res.json({
            success: true,
            contracts: [
                { contract_name: 'jsondata' },
                { contract_name: 'golangcounter' },
                { contract_name: 'datastore' }
            ]
        });
    }
});

// 查询交易信息
app.post('/api/tx/query', async (req, res) => {
    const { txid, chain, container, rpcPort } = req.body;
    
    try {
        const command = `docker exec ${container} ./bin/xchain-cli tx query ${txid} -H 127.0.0.1:${rpcPort}`;
        const { stdout, stderr } = await execAsync(command);
        
        if (stderr && !stdout) {
            return res.status(500).json({ error: stderr });
        }
        
        try {
            const data = JSON.parse(stdout);
            res.json(data);
        } catch (parseError) {
            res.status(500).json({ error: '解析响应失败', raw: stdout });
        }
    } catch (error) {
        res.status(500).json({ 
            error: '查询交易失败', 
            message: error.message 
        });
    }
});

// Get transaction list from blocks
app.post('/api/transactions/list', async (req, res) => {
    const { chain, container, rpcPort, startBlock, endBlock } = req.body;
    
    try {
        // First get current block height
        const statusCmd = `docker exec ${container} ./bin/xchain-cli status -H 127.0.0.1:${rpcPort}`;
        const { stdout: statusStdout } = await execAsync(statusCmd);
        const statusData = JSON.parse(statusStdout);
        
        if (!statusData.blockchains || statusData.blockchains.length === 0) {
            return res.json({ success: true, transactions: [] });
        }
        
        const currentHeight = statusData.blockchains[0].ledger.trunkHeight || 0;
        const start = startBlock !== null && startBlock !== undefined ? parseInt(startBlock) : Math.max(1, currentHeight - 1000);
        const end = endBlock !== null && endBlock !== undefined ? parseInt(endBlock) : currentHeight;
        
        const transactions = [];
        
        // Fetch transactions from blocks (limit to last 1000 blocks, but sample to improve performance)
        const blockRange = Math.min(1000, end - start + 1);
        const actualStart = Math.max(1, end - blockRange + 1);
        
        // Sample strategy: check every block in last 100, then every 5th block for older blocks
        const blocksToCheck = [];
        const recentBlocks = Math.min(100, end - actualStart + 1);
        for (let h = end; h >= end - recentBlocks + 1 && h >= actualStart; h--) {
            blocksToCheck.push(h);
        }
        // Add every 5th block for older range
        for (let h = end - recentBlocks; h >= actualStart; h -= 5) {
            if (!blocksToCheck.includes(h)) {
                blocksToCheck.push(h);
            }
        }
        blocksToCheck.sort((a, b) => b - a); // Sort descending
        
        console.log(`Checking ${blocksToCheck.length} blocks (sampled from ${actualStart} to ${end}) for chain ${chain}`);
        
        for (const height of blocksToCheck) {
            try {
                const blockCmd = `docker exec ${container} ./bin/xchain-cli block ${height} -N --name ${chain} -H 127.0.0.1:${rpcPort}`;
                const { stdout: blockStdout } = await execAsync(blockCmd, { timeout: 5000 });
                const blockData = JSON.parse(blockStdout);
                
                // Block data structure: transactions is directly in blockData, not blockData.block
                if (blockData.transactions && blockData.transactions.length > 0) {
                    blockData.transactions.forEach(tx => {
                        // Include all transactions (both coinbase and contract calls)
                        // Mark if transaction has contract calls
                        const hasContract = !!(tx.contractRequests && tx.contractRequests.length > 0);
                        transactions.push({
                            ...tx,
                            blockHeight: height,
                            blockid: blockData.blockid,
                            hasContract: hasContract
                        });
                    });
                }
            } catch (error) {
                // Skip blocks that don't exist or can't be read
                console.warn(`Failed to read block ${height} from ${chain}:`, error.message);
            }
        }
        
        res.json({
            success: true,
            transactions: transactions,
            total: transactions.length,
            blockRange: { start: actualStart, end: end, current: currentHeight }
        });
    } catch (error) {
        console.error('Failed to fetch transactions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transactions',
            message: error.message
        });
    }
});

// Record combination intent on main chain
app.post('/api/record-intent', async (req, res) => {
    const { taskId, selectedData, timestamp } = req.body;
    
    try {
        const container = 'xuperchain-main-node1';
        const rpcPort = 37101;
        const chainName = 'xuper';
        const contractName = 'jsondata';
        const keysPath = 'data/keys';
        
        // Build intent record
        const intentRecord = {
            taskId: taskId,
            timestamp: timestamp,
            selectedData: selectedData.map(item => ({
                chain: item.chain,
                key: item.key,
                delay: item.value?.qos?.delay || 0,
                availability: item.value?.qos?.availability || 0
            })),
            status: 'initiated'
        };
        
        // Convert to JSON and base64 encode
        const valueJson = JSON.stringify(intentRecord);
        const argsObj = {
            key: taskId,
            value: valueJson
        };
        const jsonStr = JSON.stringify(argsObj);
        const b64 = Buffer.from(jsonStr).toString('base64');
        
        // Write to main chain using jsondata contract
        // Fee must be at least 400 (gas consumption is around 379)
        const writeCmd = `docker exec ${container} sh -c 'cd /home/xchain && echo "${b64}" | base64 -d > /tmp/intent_args.json && ARGS=$(cat /tmp/intent_args.json) && ./bin/xchain-cli native invoke --method Set -a "$ARGS" ${contractName} --fee 400 --keys ${keysPath} -H 127.0.0.1:${rpcPort} --name ${chainName}'`;
        
        const { stdout, stderr } = await execAsync(writeCmd);
        
        if (stderr && !stdout) {
            return res.status(500).json({
                success: false,
                error: 'Record intent failed',
                message: stderr
            });
        }
        
        // Extract TX ID
        let txid = '';
        if (stdout) {
            const txidMatch = stdout.match(/Tx id:\s*([a-fA-F0-9]+)/);
            if (txidMatch) {
                txid = txidMatch[1];
            }
        }
        
        res.json({
            success: true,
            txid: txid,
            taskId: taskId,
            message: 'Intent recorded'
        });
    } catch (error) {
        console.error('Record intent failed:', error);
        res.status(500).json({
            success: false,
            error: 'Record intent failed',
            message: error.message
        });
    }
});

// Transfer tokens between chains
app.post('/api/transfer', async (req, res) => {
    const { fromChain, toChain, toAddress, amount, fromContainer, fromRpcPort } = req.body;
    
    try {
        // Use cross-chain format: address@chainName
        const crossChainAddress = `${toAddress}@${toChain}`;
        
        // Transfer from main chain to subchain using cross-chain format
        const transferCmd = `docker exec ${fromContainer} ./bin/xchain-cli transfer --to ${crossChainAddress} --amount ${amount} --keys data/keys -H 127.0.0.1:${fromRpcPort} --name ${fromChain}`;
        
        const { stdout, stderr } = await execAsync(transferCmd);
        
        // Check for errors
        if (stderr && !stdout) {
            return res.status(500).json({
                success: false,
                error: 'Transfer failed',
                message: stderr
            });
        }
        
        // Extract TX ID from output
        // Format can be: "Tx id: xxxxx" or just the hex string
        let txid = '';
        if (stdout) {
            // Try multiple patterns
            const patterns = [
                /Tx id:\s*([a-fA-F0-9]+)/i,
                /Tx\s+id:\s*([a-fA-F0-9]+)/i,
                /^([a-fA-F0-9]{64})$/m,  // Just hex string (64 chars)
                /([a-fA-F0-9]{64})/  // Hex string anywhere
            ];
            
            for (const pattern of patterns) {
                const match = stdout.match(pattern);
                if (match) {
                    txid = match[1];
                    break;
                }
            }
        }
        
        // If no txid found, check if there's an error message
        if (!txid) {
            const errorMsg = stderr || stdout || 'Unknown error';
            return res.status(500).json({
                success: false,
                error: 'Transfer failed - no transaction ID',
                message: errorMsg
            });
        }
        
        res.json({
            success: true,
            txid: txid,
            fromChain: fromChain,
            toChain: toChain,
            amount: amount,
            message: 'Transfer completed'
        });
    } catch (error) {
        console.error('Transfer failed:', error);
        res.status(500).json({
            success: false,
            error: 'Transfer failed',
            message: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 静态文件服务（必须在API路由之后）
app.use(express.static(path.join(__dirname)));

// 根路径返回index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 节点页面路由
app.get('/nodes.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'nodes.html'));
});

// 用户页面路由
app.get('/users.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'users.html'));
});

// 数据页面路由
app.get('/data.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'data.html'));
});

app.listen(PORT, () => {
    console.log(`前端服务器运行在 http://localhost:${PORT}`);
    console.log(`API服务运行在 http://localhost:${PORT}/api`);
});

