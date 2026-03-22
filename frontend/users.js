// API代理地址
const API_BASE = 'http://localhost:3000/api';

// 当前登录用户信息
let currentUser = null;

// Chain configuration
const chains = {
    xuper: { name: 'Main Chain', chainName: 'xuper', container: 'xuperchain-main-node1', rpcPort: 37101 },
    subchain1: { name: 'SubChain 1', chainName: 'subchain1', container: 'xuperchain-sub1-node1', rpcPort: 37102 },
    subchain2: { name: 'SubChain 2', chainName: 'subchain2', container: 'xuperchain-sub2-node1', rpcPort: 37103 },
    subchain3: { name: 'SubChain 3', chainName: 'subchain3', container: 'xuperchain-sub3-node1', rpcPort: 37104 }
};

// 从localStorage加载账户列表
function loadAccounts() {
    const accounts = JSON.parse(localStorage.getItem('xuperchain_accounts') || '[]');
    return accounts;
}

// 保存账户列表到localStorage
function saveAccounts(accounts) {
    localStorage.setItem('xuperchain_accounts', JSON.stringify(accounts));
}

// 从localStorage加载当前登录用户
function loadCurrentUser() {
    const user = localStorage.getItem('xuperchain_current_user');
    return user ? JSON.parse(user) : null;
}

// 保存当前登录用户到localStorage
function saveCurrentUser(user) {
    if (user) {
        localStorage.setItem('xuperchain_current_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('xuperchain_current_user');
    }
}

// 创建账户
async function createAccount(event) {
    event.preventDefault();
    
    const accountName = document.getElementById('account-name').value.trim();
    const chainKey = document.getElementById('create-chain').value;
    const chain = chains[chainKey];
    
    if (!accountName) {
        alert('Please enter account name');
        return;
    }
    
    try {
        // 调用API创建账户
        const response = await fetch(`${API_BASE}/account/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accountName: accountName,
                chain: chain.chainName,
                container: chain.container,
                rpcPort: chain.rpcPort
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 保存账户信息到localStorage
            const accounts = loadAccounts();
            const newAccount = {
                name: accountName,
                address: data.address,
                chain: chain.chainName,
                chainKey: chainKey,
                createdAt: new Date().toISOString()
            };
            accounts.push(newAccount);
            saveAccounts(accounts);
            
            // 更新UI
            updateAccountList();
            document.getElementById('create-account-form').reset();
            
            alert(`Account created successfully!\nAddress: ${data.address}`);
        } else {
            alert('Failed to create account: ' + (data.error || data.message));
        }
    } catch (error) {
        console.error('Failed to create account:', error);
        alert('Failed to create account: ' + error.message);
    }
}

// 更新账户列表
function updateAccountList() {
    const accounts = loadAccounts();
    const listEl = document.getElementById('account-list');
    const loginSelect = document.getElementById('login-account');
    
    if (accounts.length === 0) {
        listEl.innerHTML = '<p class="text-gray-500 text-sm text-center py-4">No accounts, please create an account first</p>';
        loginSelect.innerHTML = '<option value="">Please select an account</option>';
        return;
    }
    
    // Update account list display
    listEl.innerHTML = accounts.map((account, index) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
            <div class="flex-1">
                <div class="font-medium text-gray-800">${account.name}</div>
                <div class="text-xs text-gray-500 mt-1">
                    <code class="bg-gray-200 px-2 py-1 rounded">${account.address.substring(0, 16)}...</code>
                </div>
                <div class="text-xs text-gray-400 mt-1">${chains[account.chainKey]?.name || account.chain}</div>
            </div>
            <button onclick="deleteAccount(${index})" class="ml-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded text-sm">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    // Update login select box
    loginSelect.innerHTML = '<option value="">Please select an account</option>' + 
        accounts.map((account, index) => 
            `<option value="${index}">${account.name} (${account.address.substring(0, 12)}...)</option>`
        ).join('');
}

// Delete account
function deleteAccount(index) {
    if (!confirm('Are you sure you want to delete this account?')) {
        return;
    }
    
    const accounts = loadAccounts();
    const deletedAccount = accounts[index];
    
    // If deleting the currently logged in account, logout
    if (currentUser && currentUser.address === deletedAccount.address) {
        logout();
    }
    
    accounts.splice(index, 1);
    saveAccounts(accounts);
    updateAccountList();
}

// 显示登录模态框
function showLoginModal() {
    updateAccountList();
    document.getElementById('login-modal').classList.remove('hidden');
}

// 隐藏登录模态框
function hideLoginModal() {
    document.getElementById('login-modal').classList.add('hidden');
}

// 登录
async function login(event) {
    event.preventDefault();
    
    const accountIndex = parseInt(document.getElementById('login-account').value);
    const chainKey = document.getElementById('login-chain').value;
    const chain = chains[chainKey];
    
    if (isNaN(accountIndex)) {
        alert('Please select an account');
        return;
    }
    
    const accounts = loadAccounts();
    const account = accounts[accountIndex];
    
    try {
        // 查询账户余额
        const response = await fetch(`${API_BASE}/account/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: account.address,
                chain: chain.chainName,
                container: chain.container,
                rpcPort: chain.rpcPort
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 设置当前用户
            currentUser = {
                ...account,
                chainKey: chainKey,
                balance: data.balance || '0',
                keysPath: `data/${account.name || 'keys'}`,
                chainInfo: {
                    name: chain.name,
                    chainName: chain.chainName,
                    container: chain.container,
                    rpcPort: chain.rpcPort
                }
            };
            saveCurrentUser(currentUser);
            
            // 更新UI
            updateUserInfo();
            hideLoginModal();
        } else {
            alert('登录失败: ' + (data.error || data.message));
        }
    } catch (error) {
        console.error('登录失败:', error);
        alert('登录失败: ' + error.message);
    }
}

// 更新用户信息显示
async function updateUserInfo() {
    if (!currentUser) {
        currentUser = loadCurrentUser();
    }
    
    const notLoggedInDiv = document.getElementById('not-logged-in');
    const loggedInDiv = document.getElementById('logged-in');
    
    if (!currentUser) {
        // Show not logged in state
        notLoggedInDiv.classList.remove('hidden');
        loggedInDiv.classList.add('hidden');
        return;
    }
    
    // Show logged in state
    notLoggedInDiv.classList.add('hidden');
    loggedInDiv.classList.remove('hidden');
    
    // Update account details
    document.getElementById('detail-address').textContent = currentUser.address;
    document.getElementById('detail-balance').textContent = formatBalance(currentUser.balance);
    document.getElementById('detail-chain').textContent = chains[currentUser.chainKey]?.name || currentUser.chain;
}

// Refresh balance
async function refreshBalance() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/account/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: currentUser.address,
                chain: currentUser.chainInfo.chainName,
                container: currentUser.chainInfo.container,
                rpcPort: currentUser.chainInfo.rpcPort
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser.balance = data.balance || '0';
            saveCurrentUser(currentUser);
            updateUserInfo();
        } else {
            alert('Failed to refresh balance: ' + (data.error || data.message));
        }
    } catch (error) {
        console.error('Failed to refresh balance:', error);
        alert('Failed to refresh balance: ' + error.message);
    }
}

// Logout
function logout() {
    currentUser = null;
    saveCurrentUser(null);
    updateUserInfo();
}

// Copy address
function copyAddress() {
    if (!currentUser) return;
    
    navigator.clipboard.writeText(currentUser.address).then(() => {
        alert('Address copied to clipboard');
    });
}

// 格式化余额
function formatBalance(balance) {
    if (!balance) return '0';
    const num = BigInt(balance);
    // XuperChain使用8位小数
    const divisor = BigInt(100000000);
    const whole = num / divisor;
    const fraction = num % divisor;
    return `${whole}.${fraction.toString().padStart(8, '0')}`;
}

// 扫描容器内已存在的账户
async function scanAccounts() {
    const chainsToScan = ['xuper', 'subchain1', 'subchain2', 'subchain3'];
    const allAccounts = [];
    
    for (const chainKey of chainsToScan) {
        const chain = chains[chainKey];
        if (!chain) continue;
        
        try {
            const response = await fetch(`${API_BASE}/account/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chain: chain.chainName,
                    container: chain.container,
                    rpcPort: chain.rpcPort
                })
            });
            
            const data = await response.json();
            if (response.ok && data.accounts) {
                data.accounts.forEach(account => {
                    // 检查是否已存在
                    const existing = allAccounts.find(a => 
                        a.address === account.address && a.chain === account.chain
                    );
                    if (!existing) {
                        allAccounts.push({
                            name: account.name,
                            address: account.address,
                            chain: account.chain,
                            chainKey: chainKey,
                            keysPath: account.keysPath,
                            createdAt: new Date().toISOString()
                        });
                    }
                });
            }
        } catch (error) {
            console.error(`扫描${chain.name}账户失败:`, error);
        }
    }
    
    // 合并到现有账户列表
    const existingAccounts = loadAccounts();
    const mergedAccounts = [...existingAccounts];
    
    allAccounts.forEach(newAccount => {
        const exists = mergedAccounts.find(a => 
            a.address === newAccount.address && a.chain === newAccount.chain
        );
        if (!exists) {
            mergedAccounts.push(newAccount);
        }
    });
    
    saveAccounts(mergedAccounts);
    updateAccountList();
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    updateAccountList();
    updateUserInfo();
    // 自动扫描已存在的账户
    scanAccounts();
});

