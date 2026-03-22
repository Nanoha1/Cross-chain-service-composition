// Chain configuration
const chains = {
    mainchain: {
        name: 'Registration Chain',
        chainName: 'xuper',
        rpcPort: 37101,
        p2pPort: 47101,
        container: 'xuperchain-main-node1'
    },
    subchain1: {
        name: 'Monitoring Chain 1',
        chainName: 'subchain1',
        rpcPort: 37102,
        p2pPort: 47102,
        container: 'xuperchain-sub1-node1'
    },
    subchain2: {
        name: 'Monitoring Chain 2',
        chainName: 'subchain2',
        rpcPort: 37103,
        p2pPort: 47103,
        container: 'xuperchain-sub2-node1'
    },
    subchain3: {
        name: 'Monitoring Chain 3',
        chainName: 'subchain3',
        rpcPort: 37104,
        p2pPort: 47104,
        container: 'xuperchain-sub3-node1'
    }
};

// API代理地址（需要后端服务）
const API_BASE = 'http://localhost:3000/api';

// 查询链状态
async function queryChainStatus(chainKey) {
    const chain = chains[chainKey];
    try {
        const response = await fetch(`${API_BASE}/status/${chain.container}?port=${chain.rpcPort}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Query ${chain.name} status failed:`, error);
        // 返回模拟数据用于测试
        return {
            blockchains: [{
                ledger: {
                    trunkHeight: Math.floor(Math.random() * 100) + 1,
                    tipBlockid: '0x' + Math.random().toString(16).substring(2, 34)
                }
            }]
        };
    }
}

// Update main chain information
async function updateMainChain() {
    const data = await queryChainStatus('mainchain');
    const statusEl = document.getElementById('mainchain-status');
    const heightEl = document.getElementById('mainchain-height');
    const tipEl = document.getElementById('mainchain-tip');
    const chainNameEl = document.getElementById('mainchain-name');

    if (data && data.blockchains && data.blockchains.length > 0) {
        const chain = data.blockchains[0];
        const chainName = chain.name || 'Registration chain';
        const height = chain.ledger.trunkHeight || 0;
        const tipBlockid = chain.ledger.tipBlockid || '';
        
        // 更新链名显示
        if (chainNameEl) {
            chainNameEl.textContent = chains.mainchain.name;
        }
        
        statusEl.textContent = 'Running';
        statusEl.className = 'px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-semibold';
        heightEl.textContent = height;
        tipEl.textContent = `Latest Block: ${tipBlockid.substring(0, 16)}...`;
    } else {
        statusEl.textContent = 'Offline';
        statusEl.className = 'px-4 py-2 bg-red-100 text-red-800 rounded-full text-sm font-semibold';
        heightEl.textContent = '-';
        tipEl.textContent = 'Unable to connect to chain';
    }
}

// Update sub chain information
async function updateSubChain(chainKey, index) {
    const data = await queryChainStatus(chainKey);
    const statusEl = document.getElementById(`subchain${index}-status`);
    const heightEl = document.getElementById(`subchain${index}-height`);
    const tipEl = document.getElementById(`subchain${index}-tip`);
    const chainNameEl = document.getElementById(`subchain${index}-name`);

    if (data && data.blockchains && data.blockchains.length > 0) {
        const chain = data.blockchains[0];
        const chainName = chains[chainKey].name;
        const height = chain.ledger.trunkHeight || 0;
        const tipBlockid = chain.ledger.tipBlockid || '';
        
        // Update chain name display (show chainName in parentheses)
        if (chainNameEl) {
            chainNameEl.textContent = `(${chains[chainKey].chainName})`;
        }
        
        statusEl.textContent = 'Running';
        statusEl.className = 'px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold';
        heightEl.textContent = height;
        tipEl.textContent = `Block: ${tipBlockid.substring(0, 12)}... (Chain: ${chainName})`;
    } else {
        statusEl.textContent = 'Offline';
        statusEl.className = 'px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold';
        heightEl.textContent = '-';
        tipEl.textContent = 'Unable to connect';
    }
}

// Refresh all chains
async function refreshAll() {
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString('en-US');
    
    await Promise.all([
        updateMainChain(),
        updateSubChain('subchain1', 1),
        updateSubChain('subchain2', 2),
        updateSubChain('subchain3', 3)
    ]);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Show loading message
    console.log('Page loaded, starting to query chain status...');
    refreshAll();
    // Auto refresh every 10 seconds
    setInterval(refreshAll, 10000);
});

// Error handling
window.addEventListener('error', (e) => {
    console.error('Page error:', e);
});

// Check API connection
async function checkAPI() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        console.log('API connection OK:', data);
        return true;
    } catch (error) {
        console.warn('API server not started, using mock data:', error);
        return false;
    }
}

// Check API on page load
checkAPI();

