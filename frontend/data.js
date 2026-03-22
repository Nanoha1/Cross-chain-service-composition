// API代理地址
const API_BASE = 'http://localhost:3000/api';

// Chain configuration
const chains = {
    xuper: { name: 'Main Chain', chainName: 'xuper', container: 'xuperchain-main-node1', rpcPort: 37101 },
    subchain1: { name: 'SubChain 1', chainName: 'subchain1', container: 'xuperchain-sub1-node1', rpcPort: 37102 },
    subchain2: { name: 'SubChain 2', chainName: 'subchain2', container: 'xuperchain-sub2-node1', rpcPort: 37103 },
    subchain3: { name: 'SubChain 3', chainName: 'subchain3', container: 'xuperchain-sub3-node1', rpcPort: 37104 }
};

// 当前用户（登录用户）
let currentUser = null;

// 当前选择的链（可以切换）
let currentChainKey = 'xuper';

// 当前选择的账户（用于写入数据，可以切换）
let selectedAccount = null;

// 所有账户列表
let allAccounts = [];

// 获取当前链配置
function getCurrentChain() {
    return chains[currentChainKey] || chains.xuper;
}

// 从localStorage加载当前用户
function loadCurrentUser() {
    try {
        const user = localStorage.getItem('xuperchain_current_user');
        if (!user) {
            console.log('localStorage中没有用户信息');
            return null;
        }
        const parsed = JSON.parse(user);
        console.log('加载用户信息:', parsed);
        return parsed;
    } catch (error) {
        console.error('加载用户信息失败:', error);
        return null;
    }
}

// 从localStorage加载所有账户
function loadAllAccounts() {
    const accounts = JSON.parse(localStorage.getItem('xuperchain_accounts') || '[]');
    return accounts;
}

// 更新链显示信息
function updateChainDisplay() {
    const currentChain = getCurrentChain();
    const chainDisplayEl = document.getElementById('current-chain-display');
    const chainNameEl = document.getElementById('current-chain-name');
    
    if (chainDisplayEl) {
        chainDisplayEl.textContent = currentChain.name;
    }
    if (chainNameEl) {
        chainNameEl.textContent = currentChain.chainName;
    }
    
    // 链切换时，更新账户列表和合约列表
    updateAccountSelector();
    loadContracts();
}

// 更新账户选择器
async function updateAccountSelector() {
    const selector = document.getElementById('account-selector');
    if (!selector) return;
    
    // 获取当前链
    const currentChain = getCurrentChain();
    
    // 从localStorage加载所有账户
    allAccounts = loadAllAccounts();
    
    // 过滤当前链上的账户（如果账户有chain字段，则匹配；否则显示所有账户）
    const chainAccounts = allAccounts.filter(acc => {
        // 如果账户有chain字段，匹配当前链
        if (acc.chain) {
            return acc.chain === currentChain.chainName;
        }
        // 如果账户有chainKey字段，匹配当前链key
        if (acc.chainKey) {
            return acc.chainKey === currentChainKey;
        }
        // 否则显示所有账户（兼容旧数据）
        return true;
    });
    
    // 清空选择器
    selector.innerHTML = '';
    
    if (chainAccounts.length === 0) {
        selector.innerHTML = '<option value="">No accounts on current chain</option>';
        selectedAccount = null;
        updateAccountDisplay();
        return;
    }
    
    // 添加账户选项
    chainAccounts.forEach(acc => {
        const option = document.createElement('option');
        option.value = acc.address;
        option.textContent = `${acc.name || '未命名'} (${acc.address.substring(0, 8)}...)`;
        option.dataset.account = JSON.stringify(acc);
        selector.appendChild(option);
    });
    
    // 如果之前选择的账户在当前链上，保持选择；否则选择第一个
    if (selectedAccount) {
        const found = chainAccounts.find(acc => acc.address === selectedAccount.address);
        if (found) {
            selector.value = found.address;
            selectedAccount = found;
        } else {
            selector.value = chainAccounts[0].address;
            selectedAccount = chainAccounts[0];
        }
    } else {
        selector.value = chainAccounts[0].address;
        selectedAccount = chainAccounts[0];
    }
    
    // 更新账户显示和余额
    updateAccountDisplay();
    await refreshAccountBalance();
}

// 切换账户
function switchAccount() {
    const selector = document.getElementById('account-selector');
    if (!selector || !selector.value) {
        selectedAccount = null;
        updateAccountDisplay();
        return;
    }
    
    const selectedOption = selector.options[selector.selectedIndex];
    if (selectedOption.dataset.account) {
        selectedAccount = JSON.parse(selectedOption.dataset.account);
        updateAccountDisplay();
        refreshAccountBalance();
    }
}

// 更新账户显示
function updateAccountDisplay() {
    const addressEl = document.getElementById('selected-account-address');
    const balanceEl = document.getElementById('selected-account-balance');
    
    if (selectedAccount) {
        if (addressEl) {
            addressEl.textContent = selectedAccount.address;
        }
        if (balanceEl) {
            balanceEl.textContent = '加载中...';
        }
    } else {
        if (addressEl) {
            addressEl.textContent = '-';
        }
        if (balanceEl) {
            balanceEl.textContent = '-';
        }
    }
}

// 格式化余额（与用户管理页面相同的方法）
function formatBalance(balance) {
    if (!balance) return '0';
    const num = BigInt(balance);
    // XuperChain使用8位小数
    const divisor = BigInt(100000000);
    const whole = num / divisor;
    const fraction = num % divisor;
    return `${whole}.${fraction.toString().padStart(8, '0')}`;
}

// 刷新账户余额
async function refreshAccountBalance() {
    if (!selectedAccount) {
        updateAccountDisplay();
        return;
    }
    
    const currentChain = getCurrentChain();
    const balanceEl = document.getElementById('selected-account-balance');
    
    if (!balanceEl) return;
    
    // 显示加载状态
    balanceEl.textContent = '查询中...';
    balanceEl.className = 'ml-2 font-semibold text-sm text-gray-500';
    
    try {
        const response = await fetch(`${API_BASE}/account/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: selectedAccount.address,
                chain: currentChain.chainName,
                container: currentChain.container,
                rpcPort: currentChain.rpcPort
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const balance = data.balance || '0';
            const formattedBalance = formatBalance(balance);
            balanceEl.textContent = formattedBalance;
            
            // 根据余额设置颜色
            const balanceNum = BigInt(balance);
            if (balanceNum >= BigInt(1000)) {
                balanceEl.className = 'ml-2 font-semibold text-sm text-green-600';
            } else if (balanceNum > BigInt(0)) {
                balanceEl.className = 'ml-2 font-semibold text-sm text-yellow-600';
            } else {
                balanceEl.className = 'ml-2 font-semibold text-sm text-red-600';
            }
        } else {
            balanceEl.textContent = '查询失败';
            balanceEl.className = 'ml-2 font-semibold text-sm text-red-600';
            console.error('查询余额失败:', data.error || data.message);
        }
    } catch (error) {
        console.error('查询余额失败:', error);
        balanceEl.textContent = '查询失败';
        balanceEl.className = 'ml-2 font-semibold text-sm text-red-600';
    }
}

// 检查登录状态
function checkLogin() {
    currentUser = loadCurrentUser();
    
    const loginPrompt = document.getElementById('login-prompt');
    const queryDataCard = document.getElementById('query-data-card');
    const dataListCard = document.getElementById('data-list-card');
    
    if (!loginPrompt || !queryDataCard || !dataListCard) {
        console.warn('页面元素未加载完成，延迟检查登录状态');
        setTimeout(checkLogin, 100);
        return false;
    }
    
    if (!currentUser) {
        loginPrompt.classList.remove('hidden');
        queryDataCard.classList.add('hidden');
        dataListCard.classList.add('hidden');
        return false;
    }
    
    loginPrompt.classList.add('hidden');
    queryDataCard.classList.remove('hidden');
    dataListCard.classList.remove('hidden');
    
    // 更新链显示（会自动更新账户选择器）
    updateChainDisplay();
    
    // 加载数据列表
    refreshDataList();
    
    return true;
}

// 写入数据到链上
async function writeData(event) {
    event.preventDefault();
    
    if (!currentUser) {
        alert('请先登录');
        return;
    }
    
    if (!selectedAccount) {
        alert('请先选择账户');
        return;
    }
    
    const key = document.getElementById('data-key').value.trim();
    const value = document.getElementById('data-value').value.trim();
    const dataType = document.getElementById('data-type').value;
    const contractName = document.getElementById('contract-name').value.trim() || 'golangcounter';
    
    if (!key || !value) {
        alert('请输入数据键和值');
        return;
    }
    
    try {
        // 根据数据类型处理值
        let processedValue = value;
        if (dataType === 'json') {
            // 验证JSON格式
            try {
                JSON.parse(value);
                processedValue = value;
            } catch (e) {
                alert('JSON格式错误');
                return;
            }
        } else if (dataType === 'number') {
            // 验证数字格式
            if (isNaN(value)) {
                alert('请输入有效的数字');
                return;
            }
            processedValue = value;
        }
        
        // 获取当前选择的链配置
        const currentChain = getCurrentChain();
        
        // 确定密钥路径：优先使用当前链上存在的路径
        let keysPath = currentUser.keysPath || `data/${currentUser.name || 'keys'}`;
        
        // 检查当前链的容器中是否存在该密钥路径
        try {
            const checkPathResponse = await fetch(`${API_BASE}/account/check-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    container: currentChain.container,
                    keysPath: keysPath
                })
            });
            
            const checkResult = await checkPathResponse.json();
            
            // 如果路径不存在，尝试使用默认路径
            if (!checkResult.exists) {
                // 尝试默认路径
                const defaultPath = 'data/keys';
                const checkDefaultResponse = await fetch(`${API_BASE}/account/check-keys`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        container: currentChain.container,
                        keysPath: defaultPath
                    })
                });
                
                const checkDefaultResult = await checkDefaultResponse.json();
                
                if (checkDefaultResult.exists) {
                    keysPath = defaultPath;
                } else {
                    // 如果默认路径也不存在，提示用户
                    alert(`Cannot find account keys on current chain ${currentChain.name}.\n\nPlease go to User Management page to create an account on the current chain, or use the default account path data/keys.`);
                    return;
                }
            }
        } catch (checkError) {
            console.warn('检查密钥路径失败，使用原始路径:', checkError);
            // 如果检查失败，继续使用原始路径
        }
        
        // 准备请求数据（使用当前选择的链和账户）
        const requestData = {
            key: key,
            value: processedValue,
            dataType: dataType,
            contractName: contractName,
            address: selectedAccount.address,
            chain: currentChain.chainName,
            container: currentChain.container,
            rpcPort: currentChain.rpcPort,
            keysPath: selectedAccount.keysPath || keysPath
        };
        
        console.log('写入数据请求:', requestData);
        
        // 调用API写入数据
        const response = await fetch(`${API_BASE}/data/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        console.log('响应状态:', response.status, response.statusText);
        
        let data;
        try {
            const text = await response.text();
            console.log('响应内容:', text);
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('解析响应失败:', parseError);
            alert('服务器响应格式错误，请查看控制台');
            return;
        }
        
        if (response.ok) {
            let message = `数据写入成功！\n交易ID: ${data.txid}\n合约响应: ${data.response}`;
            if (data.note) {
                message += `\n\n注意: ${data.note}`;
            }
            alert(message);
            
            // 保存到本地数据列表（使用当前选择的链和账户）
            const currentChain = getCurrentChain();
            saveDataRecord(key, value, dataType, data.txid, currentChain.chainName, selectedAccount.address);
            
            // 保存已上传的key到localStorage
            saveUploadedKey(currentChain.chainName, key);
            
            // 刷新余额
            await refreshAccountBalance();
            
            // 刷新数据列表
            refreshDataList();
            
            // 清空表单
            document.getElementById('data-key').value = '';
            document.getElementById('data-value').value = '';
        } else {
            let errorMsg = data.error || data.message || '未知错误';
            if (data.balance !== undefined) {
                errorMsg += `\n当前余额: ${data.balance}`;
            }
            if (data.hint) {
                errorMsg += '\n\n提示: ' + data.hint;
            }
            if (data.details) {
                errorMsg += '\n\n详细信息: ' + JSON.stringify(data.details, null, 2);
            }
            alert('写入数据失败: ' + errorMsg);
        }
    } catch (error) {
        console.error('写入数据失败:', error);
        alert('写入数据失败: ' + error.message);
    }
}

// 更新查询进度
function updateQueryProgress(message) {
    const resultEl = document.getElementById('query-result');
    const contentEl = document.getElementById('query-result-content');
    if (resultEl && contentEl) {
        resultEl.classList.remove('hidden');
        contentEl.textContent = message;
    }
}

// 查询数据
async function queryData(event) {
    event.preventDefault();
    
    if (!currentUser) {
        alert('请先登录');
        return;
    }
    
    const key = document.getElementById('query-key').value.trim();
    const contractName = document.getElementById('query-contract').value.trim() || 'jsondata';
    
    if (!key) {
        alert('请输入数据键');
        return;
    }
    
    try {
        // 获取当前选择的链配置
        const currentChain = getCurrentChain();
        
        // 显示查询进度
        updateQueryProgress(`Querying data...\n\nKey: ${key}\nContract: ${contractName}\nChain: ${currentChain.name}\n\nPlease wait...`);
        
        const response = await fetch(`${API_BASE}/data/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: key,
                contractName: contractName,
                chain: currentChain.chainName,
                container: currentChain.container,
                rpcPort: currentChain.rpcPort
            })
        });
        
        const data = await response.json();
        
        const resultEl = document.getElementById('query-result');
        const contentEl = document.getElementById('query-result-content');
        
        if (response.ok) {
            resultEl.classList.remove('hidden');
            if (data.value) {
                // Try to parse and format JSON if possible
                let displayValue = data.value;
                try {
                    const parsed = JSON.parse(data.value);
                    displayValue = JSON.stringify(parsed, null, 2);
                } catch (e) {
                    // Not JSON, use as is
                }
                contentEl.textContent = `Key: ${key}\nContract: ${contractName}\n\nValue:\n${displayValue}`;
            } else {
                contentEl.textContent = `Key: ${key}\nResult: Data not found\n\nNote: The key may not exist on the current chain, or the contract name may be incorrect.`;
            }
        } else {
            resultEl.classList.remove('hidden');
            contentEl.textContent = `Query Failed\n\nError: ${data.error || data.message}\n\nTips:\n1. Make sure you have logged in\n2. Check if the contract name is correct (jsondata for JSON data, golangcounter for counter data)\n3. Verify the key exists on the selected chain`;
        }
    } catch (error) {
        console.error('查询数据失败:', error);
        const resultEl = document.getElementById('query-result');
        const contentEl = document.getElementById('query-result-content');
        if (resultEl && contentEl) {
            resultEl.classList.remove('hidden');
            contentEl.textContent = `Query Failed\n\nError: ${error.message}`;
        }
    }
}

// 加载合约列表
async function loadContracts() {
    const contractSelect = document.getElementById('query-contract');
    if (!contractSelect) return;
    
    try {
        const currentChain = getCurrentChain();
        
        // 显示加载状态
        contractSelect.innerHTML = '<option value="">Loading contracts...</option>';
        
        const response = await fetch(`${API_BASE}/contracts/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chain: currentChain.chainName,
                container: currentChain.container,
                rpcPort: currentChain.rpcPort
            })
        });
        
        const data = await response.json();
        
        // 清空选择器
        contractSelect.innerHTML = '';
        
        if (data.success && data.contracts && data.contracts.length > 0) {
            // 添加合约选项
            data.contracts.forEach(contract => {
                const contractName = contract.contract_name || contract;
                const option = document.createElement('option');
                option.value = contractName;
                option.textContent = contractName;
                contractSelect.appendChild(option);
            });
            
            // 默认选择 jsondata（如果存在）
            if (data.contracts.some(c => (c.contract_name || c) === 'jsondata')) {
                contractSelect.value = 'jsondata';
            } else if (data.contracts.length > 0) {
                // 否则选择第一个
                contractSelect.value = data.contracts[0].contract_name || data.contracts[0];
            }
        } else {
            // 如果没有合约，添加默认选项
            contractSelect.innerHTML = '<option value="jsondata">jsondata</option>';
            contractSelect.innerHTML += '<option value="golangcounter">golangcounter</option>';
            contractSelect.innerHTML += '<option value="datastore">datastore</option>';
            contractSelect.value = 'jsondata';
        }
    } catch (error) {
        console.error('加载合约列表失败:', error);
        // 失败时使用默认合约列表
        contractSelect.innerHTML = '<option value="jsondata">jsondata</option>';
        contractSelect.innerHTML += '<option value="golangcounter">golangcounter</option>';
        contractSelect.innerHTML += '<option value="datastore">datastore</option>';
        contractSelect.value = 'jsondata';
    }
}

// 保存数据记录到localStorage
function saveDataRecord(key, value, type, txid, chainName, address) {
    const records = JSON.parse(localStorage.getItem('xuperchain_data_records') || '[]');
    records.push({
        key: key,
        value: value,
        type: type,
        txid: txid,
        timestamp: new Date().toISOString(),
        address: address || selectedAccount?.address || currentUser.address,
        chain: chainName || getCurrentChain().chainName
    });
    localStorage.setItem('xuperchain_data_records', JSON.stringify(records));
}

// 从localStorage获取已上传的key列表
function getUploadedKeys(chainName) {
    try {
        const key = `uploaded_keys_${chainName}`;
        const keysStr = localStorage.getItem(key);
        if (keysStr) {
            return JSON.parse(keysStr);
        }
    } catch (error) {
        console.error('Failed to load uploaded keys:', error);
    }
    return [];
}

// 保存已上传的key到localStorage
function saveUploadedKey(chainName, key) {
    try {
        const keyName = `uploaded_keys_${chainName}`;
        const existingKeys = getUploadedKeys(chainName);
        if (!existingKeys.includes(key)) {
            existingKeys.push(key);
            localStorage.setItem(keyName, JSON.stringify(existingKeys));
        }
    } catch (error) {
        console.error('Failed to save uploaded key:', error);
    }
}

// 生成已知的key列表（基于写入的数据范围）
// 注意：对于全新的链，不应该生成大量预定义的key，应该只查询实际存在的数据
function generateKnownKeys(chainName) {
    // 从localStorage获取已上传的key
    const uploadedKeys = getUploadedKeys(chainName);
    return uploadedKeys;
}

// 从链上查询数据
async function queryDataFromChain(key, chainName, contractName = 'jsondata') {
    try {
        const currentChain = getCurrentChain();
        console.log(`查询数据: key=${key}, chain=${chainName}, container=${currentChain.container}, rpcPort=${currentChain.rpcPort}`);
        
        const response = await fetch(`${API_BASE}/data/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: key,
                contractName: contractName,
                chain: chainName,
                container: currentChain.container,
                rpcPort: currentChain.rpcPort
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            console.log(`查询key ${key}失败 (${response.status}):`, errorData.error || errorData.message);
            return null;
        }
        
        const data = await response.json();
        if (data.success && data.value) {
            console.log(`查询成功: key=${key}, value长度=${data.value.length}`);
            return data.value;
        } else if (data.error) {
            console.log(`查询key ${key}返回错误:`, data.error);
        } else if (data.success && !data.value) {
            // key不存在，返回空值（这是正常的，不是错误）
            console.log(`查询key ${key}: 数据不存在`);
        } else {
            console.log(`查询key ${key}: 未知响应格式`);
        }
        return null;
    } catch (error) {
        console.error(`查询key ${key}失败:`, error);
        return null;
    }
}

// 更新数据列表进度
function updateDataListProgress(current, total, success, fail) {
    const listEl = document.getElementById('data-list');
    if (!listEl) return;
    
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    listEl.innerHTML = `<p class="text-gray-500 text-sm text-center py-4"><i class="fas fa-spinner fa-spin mr-2"></i>Loading data... (${current}/${total}, ${percentage}%) - Success: ${success}, Failed: ${fail}</p>`;
}

// 刷新数据列表（从链上查询所有数据）
async function refreshDataList() {
    console.log('refreshDataList 被调用');
    
    if (!currentUser) {
        console.log('用户未登录，跳过数据加载');
        const listEl = document.getElementById('data-list');
        if (listEl) {
            listEl.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">请先登录</p>';
        }
        return;
    }
    
    // 获取当前选择的链
    const currentChain = getCurrentChain();
    console.log('当前链配置:', currentChain);
    
    const listEl = document.getElementById('data-list');
    if (!listEl) {
        console.log('data-list 元素不存在');
        return;
    }
    
    // 获取已知的key列表
    const knownKeys = generateKnownKeys(currentChain.chainName);
    console.log(`当前链: ${currentChain.chainName}, 生成的key数量: ${knownKeys.length}`);
    if (knownKeys.length > 0) {
        console.log('前5个key:', knownKeys.slice(0, 5));
    } else {
        console.log('Warning: No keys generated, may be main chain or chain name mismatch');
    }
    
    // 同时从localStorage加载旧数据
    const records = JSON.parse(localStorage.getItem('xuperchain_data_records') || '[]');
    const chainAccounts = allAccounts.filter(acc => {
        if (acc.chain) return acc.chain === currentChain.chainName;
        if (acc.chainKey) return acc.chainKey === currentChainKey;
        return true;
    }).map(acc => acc.address);
    
    const userRecords = records.filter(r => 
        chainAccounts.includes(r.address) && r.chain === currentChain.chainName
    );
    
    // 从链上查询所有已知key的数据
    const chainData = [];
    const contractName = 'jsondata';
    let successCount = 0;
    let failCount = 0;
    
    if (knownKeys.length > 0) {
        console.log(`开始查询 ${knownKeys.length} 个key的数据...`);
        updateDataListProgress(0, knownKeys.length, 0, 0);
        
        for (let i = 0; i < knownKeys.length; i++) {
            const key = knownKeys[i];
            try {
                const value = await queryDataFromChain(key, currentChain.chainName, contractName);
                if (value) {
                    let parsedValue;
                    try {
                        parsedValue = JSON.parse(value);
                    } catch (e) {
                        parsedValue = value;
                    }
                    
                    chainData.push({
                        key: key,
                        value: typeof parsedValue === 'object' ? JSON.stringify(parsedValue, null, 2) : parsedValue,
                        type: typeof parsedValue === 'object' ? 'json' : 'string',
                        chain: currentChain.chainName,
                        source: 'chain',
                        timestamp: parsedValue.qos?.timestamp || parsedValue.timestamp || new Date().toISOString()
                    });
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`查询key ${key}失败:`, error);
                failCount++;
            }
            
            // 更新进度
            updateDataListProgress(i + 1, knownKeys.length, successCount, failCount);
        }
        console.log(`链上查询完成，找到 ${chainData.length} 条数据`);
    } else {
        console.log('没有已知的key，跳过链上查询');
    }
    
    // 合并链上数据和localStorage数据（去重）
    const allRecords = [...chainData];
    console.log(`localStorage中有 ${userRecords.length} 条数据`);
    userRecords.forEach(record => {
        // 如果链上数据中没有这个key，才添加localStorage的数据
        if (!chainData.find(d => d.key === record.key)) {
            allRecords.push(record);
        }
    });
    
    console.log(`总共 ${allRecords.length} 条数据`);
    
    if (allRecords.length === 0) {
        let message = 'No data on current chain';
        if (currentChain.chainName === 'xuper') {
            message += '<br><br>Tip: Data is on sub chains, please switch to SubChain 1/2/3 to view';
        } else if (knownKeys.length === 0) {
            message += '<br><br>Tip: Current chain has no data query range configured';
        }
        listEl.innerHTML = `<p class="text-gray-500 text-sm text-center py-4">${message}</p>`;
        return;
    }
    
    // 按key排序（如果是日期格式，按日期排序）
    allRecords.sort((a, b) => {
        // 尝试提取日期部分进行排序
        const dateA = a.key.match(/\d{8}/)?.[0] || '';
        const dateB = b.key.match(/\d{8}/)?.[0] || '';
        if (dateA && dateB) {
            if (dateA !== dateB) return dateB.localeCompare(dateA);
            // 如果日期相同，按序号排序
            const numA = parseInt(a.key.match(/\d{3}$/)?.[0] || '0');
            const numB = parseInt(b.key.match(/\d{3}$/)?.[0] || '0');
            return numB - numA;
        }
        return b.key.localeCompare(a.key);
    });
    
    // 渲染数据列表
    listEl.innerHTML = allRecords.map(record => {
        const valueStr = typeof record.value === 'string' ? record.value : JSON.stringify(record.value);
        const displayValue = valueStr.length > 100 ? valueStr.substring(0, 100) + '...' : valueStr;
        const sourceBadge = record.source === 'chain' ? 
            '<span class="px-2 py-1 bg-green-100 text-green-600 text-xs rounded">链上</span>' : 
            '<span class="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">本地</span>';
        
        return `
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                    <span class="font-medium text-gray-800">${record.key}</span>
                    <span class="px-2 py-1 bg-blue-100 text-blue-600 text-xs rounded">${record.type || 'string'}</span>
                    ${sourceBadge}
                </div>
                <div class="text-sm text-gray-600 mb-1 font-mono text-xs">${displayValue}</div>
                <div class="text-xs text-gray-400">
                    ${record.timestamp ? `<span>${new Date(record.timestamp).toLocaleString('zh-CN')}</span>` : ''}
                    ${record.txid ? `<code class="bg-gray-200 px-2 py-1 rounded ml-2">${record.txid.substring(0, 16)}...</code>` : ''}
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="queryDataByKey('${record.key}')" class="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded text-sm">
                    <i class="fas fa-search"></i>
                </button>
                ${record.txid ? `<button onclick="viewTransaction('${record.txid}')" class="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-600 rounded text-sm">
                    <i class="fas fa-external-link-alt"></i>
                </button>` : ''}
            </div>
        </div>
    `;
    }).join('');
}

// 通过键查询数据
function queryDataByKey(key) {
    document.getElementById('query-key').value = key;
    document.getElementById('query-data-form').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

// 查看交易
async function viewTransaction(txid) {
    if (!currentUser) return;
    
    try {
        // 获取当前选择的链配置
        const currentChain = getCurrentChain();
        
        const response = await fetch(`${API_BASE}/tx/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                txid: txid,
                chain: currentChain.chainName,
                container: currentChain.container,
                rpcPort: currentChain.rpcPort
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const txInfo = JSON.stringify(data, null, 2);
            alert(`交易信息:\n\n${txInfo}`);
        } else {
            alert('查询交易失败: ' + (data.error || data.message));
        }
    } catch (error) {
        console.error('查询交易失败:', error);
        alert('查询交易失败: ' + error.message);
    }
}

// 切换链函数
function switchChain() {
    const selector = document.getElementById('chain-selector');
    if (!selector) return;
    
    currentChainKey = selector.value;
    
    // 保存选择
    localStorage.setItem('xuperchain_selected_chain', currentChainKey);
    
    // 更新当前链显示（会自动更新账户选择器）
    updateChainDisplay();
    
    // 如果已登录，刷新数据列表
    if (currentUser) {
        refreshDataList();
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化链选择器
    const selector = document.getElementById('chain-selector');
    if (selector) {
        // 从localStorage恢复上次选择的链
        const savedChain = localStorage.getItem('xuperchain_selected_chain');
        if (savedChain && chains[savedChain]) {
            currentChainKey = savedChain;
            selector.value = savedChain;
        }
        
        // 绑定change事件
        selector.addEventListener('change', switchChain);
        
        updateChainDisplay();
    }
    
    // 初始化账户选择器
    const accountSelector = document.getElementById('account-selector');
    if (accountSelector) {
        accountSelector.addEventListener('change', switchAccount);
    }
    
    checkLogin();
    loadContracts();
    
    // 监听账户列表变化
    window.addEventListener('storage', (e) => {
        if (e.key === 'xuperchain_accounts') {
            updateAccountSelector();
        }
    });
    
    // 监听storage变化（用户在其他标签页登录/登出）
    window.addEventListener('storage', (e) => {
        if (e.key === 'xuperchain_current_user') {
            checkLogin();
    loadContracts();
        }
    });
});

