// API base URL
const API_BASE = 'http://localhost:3000/api';

// Chain configuration
const chains = {
    xuper: { name: 'Main Chain', chainName: 'xuper', container: 'xuperchain-main-node1', rpcPort: 37101, icon: 'link', color: 'blue' },
    subchain1: { name: 'SubChain 1', chainName: 'subchain1', container: 'xuperchain-sub1-node1', rpcPort: 37102, icon: 'heartbeat', color: 'green' },
    subchain2: { name: 'SubChain 2', chainName: 'subchain2', container: 'xuperchain-sub2-node1', rpcPort: 37103, icon: 'road', color: 'yellow' },
    subchain3: { name: 'SubChain 3', chainName: 'subchain3', container: 'xuperchain-sub3-node1', rpcPort: 37104, icon: 'hospital', color: 'red' }
};

// All transactions
let allTransactions = [];
let filteredTransactions = [];

// Pagination
let currentPage = 1;
let pageSize = 20;

// Load transactions from cache
function loadTransactionsFromCache() {
    try {
        const cachedData = localStorage.getItem('transactions-cache');
        const cacheTimestamp = localStorage.getItem('transactions-cache-timestamp');
        
        if (cachedData && cacheTimestamp) {
            const data = JSON.parse(cachedData);
            const timestamp = parseInt(cacheTimestamp);
            const now = Date.now();
            const cacheAge = now - timestamp;
            
            // Cache valid for 24 hours
            if (cacheAge < 24 * 60 * 60 * 1000) {
                console.log('Loading transactions from cache, cache time:', new Date(timestamp).toLocaleString());
                allTransactions = data.allTransactions || [];
                updateStats(data.chainStats || { xuper: 0, subchain1: 0, subchain2: 0, subchain3: 0 });
                filterTransactions();
                return true;
            } else {
                console.log('Cache expired, clearing cache');
                localStorage.removeItem('transactions-cache');
                localStorage.removeItem('transactions-cache-timestamp');
            }
        }
    } catch (error) {
        console.error('Failed to load cache:', error);
    }
    return false;
}

// Save transactions to cache
function saveTransactionsToCache() {
    try {
        const chainStats = { xuper: 0, subchain1: 0, subchain2: 0, subchain3: 0 };
        allTransactions.forEach(tx => {
            if (chainStats[tx.chain] !== undefined) {
                chainStats[tx.chain]++;
            }
        });
        
        const cacheData = {
            allTransactions: allTransactions,
            chainStats: chainStats
        };
        
        localStorage.setItem('transactions-cache', JSON.stringify(cacheData));
        localStorage.setItem('transactions-cache-timestamp', Date.now().toString());
        console.log('Transactions saved to cache');
    } catch (error) {
        console.error('Failed to save cache:', error);
    }
}

// Clear cache
function clearTransactionsCache() {
    localStorage.removeItem('transactions-cache');
    localStorage.removeItem('transactions-cache-timestamp');
    console.log('Transactions cache cleared');
}

// Fetch transactions from a chain
async function fetchChainTransactions(chainKey, chainConfig, startBlock = null, endBlock = null) {
    try {
        const response = await fetch(`${API_BASE}/transactions/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chain: chainConfig.chainName,
                container: chainConfig.container,
                rpcPort: chainConfig.rpcPort,
                startBlock: startBlock,
                endBlock: endBlock
            })
        });

        if (!response.ok) {
            console.error(`Failed to fetch transactions from ${chainKey}:`, response.status);
            return [];
        }

        const data = await response.json();
        if (data.success && data.transactions) {
            return data.transactions.map(tx => ({
                ...tx,
                chain: chainKey,
                chainName: chainConfig.name
            }));
        }
        return [];
    } catch (error) {
        console.error(`Error fetching transactions from ${chainKey}:`, error);
        return [];
    }
}

// Update progress display
function updateTransactionsProgress(current, total, chainName) {
    const tableBody = document.getElementById('transactions-table-body');
    if (!tableBody) return;
    
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    tableBody.innerHTML = `<tr><td colspan="9" class="px-4 py-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading transactions... (${current}/${total}, ${percentage}%) - ${chainName}</td></tr>`;
}

// Load all transactions
async function loadAllTransactions(forceRefresh = false) {
    // Try loading from cache first, if no cache or cache expired, then query
    if (!forceRefresh && loadTransactionsFromCache()) {
        return;
    }
    
    console.log('Loading transactions from all chains...');
    
    const tableBody = document.getElementById('transactions-table-body');
    updateTransactionsProgress(0, Object.keys(chains).length, 'Initializing...');
    
    // Clear cache if force refresh
    if (forceRefresh) {
        clearTransactionsCache();
    }
    
    allTransactions = [];
    const chainStats = { xuper: 0, subchain1: 0, subchain2: 0, subchain3: 0 };
    
    // Get block range from filters (only use if both are provided)
    const startBlockInput = document.getElementById('block-start').value;
    const endBlockInput = document.getElementById('block-end').value;
    const startBlock = (startBlockInput && endBlockInput) ? parseInt(startBlockInput) : null;
    const endBlock = (startBlockInput && endBlockInput) ? parseInt(endBlockInput) : null;
    
    // Fetch transactions from all chains
    const chainEntries = Object.entries(chains);
    let currentChainIndex = 0;
    
    for (const [chainKey, chainConfig] of chainEntries) {
        currentChainIndex++;
        console.log(`Fetching transactions from ${chainConfig.name}...`);
        updateTransactionsProgress(currentChainIndex, chainEntries.length, `Querying ${chainConfig.name}...`);
        
        const transactions = await fetchChainTransactions(chainKey, chainConfig, startBlock, endBlock);
        allTransactions.push(...transactions);
        chainStats[chainKey] = transactions.length;
        
        // Update statistics
        updateStats(chainStats);
    }
    
    console.log(`Loaded ${allTransactions.length} transactions total`);
    
    // Save to cache
    saveTransactionsToCache();
    
    // Apply filters
    filterTransactions();
}

// Update statistics
function updateStats(stats) {
    document.getElementById('stat-main').textContent = stats.xuper || 0;
    document.getElementById('stat-sub1').textContent = stats.subchain1 || 0;
    document.getElementById('stat-sub2').textContent = stats.subchain2 || 0;
    document.getElementById('stat-sub3').textContent = stats.subchain3 || 0;
}

// Filter transactions
function filterTransactions() {
    const chainFilter = document.getElementById('chain-filter').value;
    const searchInput = document.getElementById('search-input').value.toLowerCase();
    
    filteredTransactions = allTransactions.filter(tx => {
        // Chain filter
        if (chainFilter !== 'all' && tx.chain !== chainFilter) {
            return false;
        }
        
        // Search filter
        if (searchInput) {
            const searchStr = searchInput.toLowerCase();
            const txid = (tx.txid || tx.Txid || '').toLowerCase();
            if (!txid.includes(searchStr)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Update total count
    document.getElementById('total-count').textContent = filteredTransactions.length;
    
    // Reset to first page when filtering
    currentPage = 1;
    
    // Render table
    renderTable();
}

// Clear filters
function clearFilters() {
    document.getElementById('chain-filter').value = 'all';
    document.getElementById('block-start').value = '';
    document.getElementById('block-end').value = '';
    document.getElementById('search-input').value = '';
    filterTransactions();
}

// Render transaction table
function renderTable() {
    const tableBody = document.getElementById('transactions-table-body');
    
    if (filteredTransactions.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="px-4 py-8 text-center text-gray-500">No transactions found</td></tr>';
        updatePagination();
        return;
    }
    
    // Sort by timestamp (newest first)
    filteredTransactions.sort((a, b) => {
        const timeA = a.timestamp || a.Timestamp || 0;
        const timeB = b.timestamp || b.Timestamp || 0;
        return timeB - timeA;
    });
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredTransactions.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredTransactions.length);
    const pageData = filteredTransactions.slice(startIndex, endIndex);
    
    tableBody.innerHTML = pageData.map(tx => {
        const chainConfig = chains[tx.chain];
        const txid = tx.txid || '-';
        const blockid = tx.blockid || '-';
        const blockHeight = tx.blockHeight || '-';
        // Timestamp is in nanoseconds, convert to milliseconds
        const timestamp = tx.timestamp;
        const timeStr = timestamp ? new Date(parseInt(timestamp.toString().substring(0, 13))).toLocaleString('en-US') : '-';
        
        // Extract from/to addresses
        const fromAddr = extractFromAddress(tx);
        const toAddr = extractToAddress(tx);
        const amount = extractAmount(tx);
        
        // Determine transaction type
        const isCoinbase = tx.coinbase || false;
        const hasContract = tx.hasContract || (tx.contractRequests && tx.contractRequests.length > 0);
        let txType = 'Transfer';
        let txTypeClass = 'bg-blue-100 text-blue-800';
        if (isCoinbase) {
            txType = 'Coinbase';
            txTypeClass = 'bg-gray-100 text-gray-800';
        } else if (hasContract) {
            txType = 'Contract';
            txTypeClass = 'bg-purple-100 text-purple-800';
        }
        
        // Chain color
        let chainColorClass = 'text-blue-600';
        if (chainConfig.color === 'green') chainColorClass = 'text-green-600';
        else if (chainConfig.color === 'yellow') chainColorClass = 'text-yellow-600';
        else if (chainConfig.color === 'red') chainColorClass = 'text-red-600';
        
        // Shorten TX ID for display
        const shortTxid = txid.length > 16 ? txid.substring(0, 16) + '...' : txid;
        const shortBlockid = blockid.length > 16 ? blockid.substring(0, 16) + '...' : blockid;
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center">
                        <i class="fas fa-${chainConfig.icon} ${chainColorClass} mr-2"></i>
                        <span class="text-sm font-medium text-gray-900">${tx.chainName}</span>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <code class="text-sm text-gray-800 bg-gray-100 px-2 py-1 rounded">${shortTxid}</code>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${blockHeight}</div>
                    <div class="text-xs text-gray-500">${shortBlockid}</div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${txTypeClass}">
                        ${txType}
                    </span>
                </td>
                <td class="px-4 py-3">
                    <code class="text-xs text-gray-600">${fromAddr.substring(0, 12)}...</code>
                </td>
                <td class="px-4 py-3">
                    <code class="text-xs text-gray-600">${toAddr.substring(0, 12)}...</code>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    ${amount}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${timeStr}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">
                    <button onclick="viewTransaction('${txid}', '${tx.chain}')" class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded text-xs">
                        <i class="fas fa-eye mr-1"></i>View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePagination();
}

// Update pagination controls
function updatePagination() {
    const totalPages = Math.ceil(filteredTransactions.length / pageSize);
    document.getElementById('current-page').textContent = currentPage;
    document.getElementById('total-pages').textContent = totalPages || 1;
    
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage >= totalPages || totalPages === 0;
}

// Change page size
function changePageSize() {
    pageSize = parseInt(document.getElementById('page-size').value);
    currentPage = 1;
    renderTable();
}

// Previous page
function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
}

// Next page
function nextPage() {
    const totalPages = Math.ceil(filteredTransactions.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}

// Extract from address from transaction
function extractFromAddress(tx) {
    if (tx.initiator) return tx.initiator;
    // Check txInputs (camelCase) or tx_inputs (snake_case)
    const inputs = tx.txInputs || tx.tx_inputs;
    if (inputs && inputs.length > 0) {
        const input = inputs[0];
        if (input.fromAddr) return input.fromAddr;
        if (input.from_addr) return input.from_addr;
        if (input.addr) return input.addr;
    }
    // For coinbase transactions, return miner address
    if (tx.coinbase) return 'Coinbase';
    return '-';
}

// Extract to address from transaction
function extractToAddress(tx) {
    // Check txOutputs (camelCase) or tx_outputs (snake_case)
    const outputs = tx.txOutputs || tx.tx_outputs;
    if (outputs && outputs.length > 0) {
        const output = outputs[0];
        if (output.toAddr) return output.toAddr;
        if (output.to_addr) return output.to_addr;
        if (output.addr) return output.addr;
    }
    return '-';
}

// Extract amount from transaction
function extractAmount(tx) {
    // Check txOutputs (camelCase) or tx_outputs (snake_case)
    const outputs = tx.txOutputs || tx.tx_outputs;
    if (outputs && outputs.length > 0) {
        const output = outputs[0];
        const amountValue = output.amount || output.Amount;
        if (amountValue) {
            const amount = BigInt(amountValue);
            const divisor = BigInt(100000000);
            const whole = amount / divisor;
            const fraction = amount % divisor;
            return `${whole}.${fraction.toString().padStart(8, '0')}`;
        }
    }
    return '-';
}

// View transaction details
async function viewTransaction(txid, chain) {
    const chainConfig = chains[chain];
    if (!chainConfig) return;
    
    try {
        const response = await fetch(`${API_BASE}/tx/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                txid: txid,
                chain: chainConfig.chainName,
                container: chainConfig.container,
                rpcPort: chainConfig.rpcPort
            })
        });
        
        if (!response.ok) {
            alert('Failed to fetch transaction details');
            return;
        }
        
        const data = await response.json();
        displayTransactionModal(data);
    } catch (error) {
        console.error('Error fetching transaction:', error);
        alert('Failed to fetch transaction details: ' + error.message);
    }
}

// Display transaction modal
function displayTransactionModal(tx) {
    const modal = document.getElementById('tx-modal');
    const content = document.getElementById('tx-detail-content');
    
    const txid = tx.txid || '-';
    const blockid = tx.blockid || '-';
    const timestamp = tx.timestamp;
    // Timestamp is in nanoseconds, convert to milliseconds
    const timeStr = timestamp ? new Date(parseInt(timestamp.toString().substring(0, 13))).toLocaleString('en-US') : '-';
    const initiator = tx.initiator || '-';
    
    content.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Transaction ID</label>
                <code class="text-sm text-gray-800 bg-gray-100 px-3 py-2 rounded block break-all">${txid}</code>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Block ID</label>
                <code class="text-sm text-gray-800 bg-gray-100 px-3 py-2 rounded block break-all">${blockid}</code>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Initiator</label>
                <code class="text-sm text-gray-800 bg-gray-100 px-3 py-2 rounded block break-all">${initiator}</code>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Timestamp</label>
                <p class="text-sm text-gray-800">${timeStr}</p>
            </div>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Transaction Details</label>
            <pre class="text-xs bg-gray-50 p-4 rounded border overflow-auto max-h-96">${JSON.stringify(tx, null, 2)}</pre>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

// Close transaction modal
function closeTxModal() {
    document.getElementById('tx-modal').classList.add('hidden');
}

// Refresh transactions
function refreshTransactions() {
    loadAllTransactions(true);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadAllTransactions(false); // Try cache first
});

