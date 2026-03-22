// 交易构建工具
// 使用xchain-cli生成未签名的交易，然后通过HTTP API提交
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const XuperChainClient = require('./xuperchain-client');

class TxBuilder {
    // 使用xchain-cli生成交易并签名，然后通过HTTP API提交
    // 这是混合方案：利用xchain-cli的签名功能，但通过HTTP API提交
    static async invokeContract(container, keysPath, contractName, methodName, args, fee, chain, rpcPort) {
        // 计算Gateway端口
        const gwPort = rpcPort + 200;
        const client = new XuperChainClient(`http://127.0.0.1:${gwPort}`);
        
        // 读取地址
        const readAddressCmd = `docker exec ${container} cat ${keysPath}/address`;
        const { stdout: address } = await execAsync(readAddressCmd);
        const initiator = address.trim();
        
        // 构建JSON参数
        const argsJson = JSON.stringify(args);
        
        // 使用临时文件传递JSON参数，避免转义问题
        const tempArgsFile = `/tmp/args_${Date.now()}.json`;
        
        try {
            // 方法：使用base64编码，然后在容器内解码写入文件
            // 在容器内运行，可以使用标准的Linux管道
            const argsBase64 = Buffer.from(argsJson).toString('base64');
            // 使用echo和管道写入，在容器内可以正常工作
            const writeArgsCmd = `docker exec ${container} sh -c 'echo "${argsBase64}" | base64 -d > ${tempArgsFile}'`;
            await execAsync(writeArgsCmd);
            
            try {
                // 使用临时文件中的JSON参数调用合约
                // 使用sh而不是bash，更简单可靠
                // 添加 --name 参数指定链名
                const invokeCmd = `docker exec ${container} sh -c 'ARGS=$(cat ${tempArgsFile}); ./bin/xchain-cli native invoke --method ${methodName} -a "$ARGS" ${contractName} --fee ${fee} --keys ${keysPath} -H 127.0.0.1:${rpcPort} --name ${chain}'`;
                
                const { stdout, stderr } = await execAsync(invokeCmd, { timeout: 30000 });
                
                if (stderr && !stdout) {
                    throw new Error(stderr);
                }
                
                // 解析输出
                const txidMatch = stdout.match(/Tx id: ([a-f0-9]+)/i);
                const responseMatch = stdout.match(/contract response: (.+)/);
                
                return {
                    txid: txidMatch ? txidMatch[1] : '',
                    response: responseMatch ? responseMatch[1].trim() : '',
                    stdout: stdout
                };
            } finally {
                // 清理临时文件
                try {
                    await execAsync(`docker exec ${container} rm -f ${tempArgsFile}`);
                } catch (e) {
                    // 忽略清理错误
                }
            }
        } catch (error) {
            throw error;
        }
    }
}

module.exports = TxBuilder;
