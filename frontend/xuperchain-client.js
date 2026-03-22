// XuperChain HTTP API客户端
const axios = require('axios');

class XuperChainClient {
    constructor(baseURL) {
        this.baseURL = baseURL || 'http://127.0.0.1:37301';
        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });
    }

    // 查询账户余额
    async getBalance(address, bcname = 'xuper') {
        try {
            const response = await this.client.post('/v1/get_balance', {
                address: address,
                bcs: [{
                    bcname: bcname
                }]
            });
            
            // 调试日志
            console.log('Gateway API响应:', JSON.stringify(response.data, null, 2));
            
            if (response.data && response.data.bcs && response.data.bcs.length > 0) {
                const bc = response.data.bcs[0];
                console.log('BC数据:', JSON.stringify(bc, null, 2));
                if (bc.error === 0 || bc.error === undefined) {
                    const balance = bc.balance || '0';
                    console.log('解析的余额:', balance);
                    return balance;
                } else {
                    console.log('BC错误码:', bc.error);
                }
            }
            console.log('未找到余额数据，返回0');
            return '0';
        } catch (error) {
            throw new Error(`查询余额失败: ${error.message}`);
        }
    }

    // 预执行合约（用于查询）
    async preExec(bcname, requests, initiator, authRequire = []) {
        try {
            const response = await this.client.post('/v1/preexec', {
                header: {
                    logid: this.generateLogId()
                },
                bcname: bcname,
                requests: requests,
                initiator: initiator,
                auth_require: authRequire
            });
            
            return response.data;
        } catch (error) {
            throw new Error(`预执行失败: ${error.message}`);
        }
    }

    // 提交交易
    async postTx(bcname, tx) {
        try {
            const response = await this.client.post('/v1/post_tx', {
                header: {
                    logid: this.generateLogId()
                },
                bcname: bcname,
                tx: tx
            });
            
            return response.data;
        } catch (error) {
            throw new Error(`提交交易失败: ${error.message}`);
        }
    }

    // 查询交易
    async queryTx(bcname, txid) {
        try {
            const response = await this.client.post('/v1/query_tx', {
                header: {
                    logid: this.generateLogId()
                },
                bcname: bcname,
                txid: txid
            });
            
            return response.data;
        } catch (error) {
            throw new Error(`查询交易失败: ${error.message}`);
        }
    }

    // 生成日志ID
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 构建合约调用请求
    buildInvokeRequest(moduleName, contractName, methodName, args, amount = '0') {
        const invokeRequest = {
            module_name: moduleName,
            contract_name: contractName,
            method_name: methodName,
            args: {},
            amount: amount
        };

        // 将JSON参数转换为bytes map
        if (typeof args === 'string') {
            try {
                args = JSON.parse(args);
            } catch (e) {
                // 如果解析失败，当作字符串处理
            }
        }

        if (typeof args === 'object') {
            for (const [key, value] of Object.entries(args)) {
                if (typeof value === 'string') {
                    invokeRequest.args[key] = Buffer.from(value).toString('base64');
                } else {
                    invokeRequest.args[key] = Buffer.from(JSON.stringify(value)).toString('base64');
                }
            }
        }

        return invokeRequest;
    }
}

module.exports = XuperChainClient;

