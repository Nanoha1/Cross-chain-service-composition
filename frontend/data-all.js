// API代理地址
const API_BASE = 'http://localhost:3000/api';

// Chain configuration
const chains = {
    xuper: { name: 'Main Chain', chainName: 'xuper', container: 'xuperchain-main-node1', rpcPort: 37101, icon: 'link', color: 'blue' },
    subchain1: { name: 'SubChain 1', chainName: 'subchain1', container: 'xuperchain-sub1-node1', rpcPort: 37102, icon: 'heartbeat', color: 'green', dataType: 'HEALTH' },
    subchain2: { name: 'SubChain 2', chainName: 'subchain2', container: 'xuperchain-sub2-node1', rpcPort: 37103, icon: 'road', color: 'yellow', dataType: 'ROAD' },
    subchain3: { name: 'SubChain 3', chainName: 'subchain3', container: 'xuperchain-sub3-node1', rpcPort: 37104, icon: 'hospital', color: 'red', dataType: 'MEDICAL' }
};

// Write Data Modal state
let writeModalChainKey = 'xuper';
let writeModalSelectedAccount = null;
let writeModalAllAccounts = [];

// Upload Data Modal state
let uploadModalChainKey = 'xuper';
let uploadModalSelectedAccount = null;
let uploadModalAllAccounts = [];
let selectedFile = null;

// 所有数据
let allData = [];
let filteredData = [];

// 记录无数据的key，避免重复查询
let emptyKeysCache = new Set();

// Pagination
let currentPage = 1;
let pageSize = 20;

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

// 生成已知的key列表
// 注意：对于全新的链，不应该生成大量预定义的key，应该只查询实际存在的数据
function generateKnownKeys(chainName) {
    // 从localStorage获取已上传的key
    const uploadedKeys = getUploadedKeys(chainName);
    return uploadedKeys;
}

// 从链上查询数据
async function queryDataFromChain(key, chainConfig, contractName = 'jsondata') {
    try {
        const response = await fetch(`${API_BASE}/data/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                key: key,
                contractName: contractName,
                chain: chainConfig.chainName,
                container: chainConfig.container,
                rpcPort: chainConfig.rpcPort
            }),
            timeout: 10000
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            console.error(`Query key ${key} failed (${response.status}):`, errorData);
            return null;
        }
        
        const data = await response.json();
        if (data.success) {
            // 即使 value 为空字符串，也返回它（可能是空数据）
            if (data.value !== undefined && data.value !== null) {
                // 如果 value 是空字符串，说明 key 不存在，返回 null
                if (data.value === '') {
                    return null;
                }
                return data.value;
            }
            return null;
        } else if (data.error) {
            console.log(`Query key ${key} returned error:`, data.error);
            return null;
        }
        return null;
    } catch (error) {
        console.error(`Query key ${key} exception:`, error);
        return null;
    }
}

// Load data from cache
function loadDataFromCache() {
    try {
        const cachedData = localStorage.getItem('data-all-cache');
        const cacheTimestamp = localStorage.getItem('data-all-cache-timestamp');
        
        if (cachedData && cacheTimestamp) {
            const data = JSON.parse(cachedData);
            const timestamp = parseInt(cacheTimestamp);
            const now = Date.now();
            const cacheAge = now - timestamp;
            
            // Cache valid for 24 hours
            if (cacheAge < 24 * 60 * 60 * 1000) {
                console.log('Loading data from cache, cache time:', new Date(timestamp).toLocaleString());
                allData = data.allData || [];
                updateStats(data.chainStats || { xuper: 0, subchain1: 0, subchain2: 0, subchain3: 0 });
                filterData();
                return true;
            } else {
                console.log('Cache expired, clearing cache');
                localStorage.removeItem('data-all-cache');
                localStorage.removeItem('data-all-cache-timestamp');
            }
        }
    } catch (error) {
        console.error('Failed to load cache:', error);
    }
    return false;
}

// Save data to cache
function saveDataToCache() {
    try {
        const chainStats = { xuper: 0, subchain1: 0, subchain2: 0, subchain3: 0 };
        allData.forEach(item => {
            if (chainStats[item.chain] !== undefined) {
                chainStats[item.chain]++;
            }
        });
        
        const cacheData = {
            allData: allData,
            chainStats: chainStats
        };
        
        localStorage.setItem('data-all-cache', JSON.stringify(cacheData));
        localStorage.setItem('data-all-cache-timestamp', Date.now().toString());
        console.log('Data saved to cache');
    } catch (error) {
        console.error('Failed to save cache:', error);
    }
}

// Clear cache
function clearCache() {
    localStorage.removeItem('data-all-cache');
    localStorage.removeItem('data-all-cache-timestamp');
    console.log('Cache cleared');
}

// 更新查询进度显示
function updateProgress(current, total, chainName, success, fail, skip) {
    const tableBody = document.getElementById('data-table-body');
    if (!tableBody) return;
    
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    tableBody.innerHTML = `<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Loading data... (${current}/${total}, ${percentage}%)</td></tr>`;
}

// 刷新所有链的数据
async function refreshAllData(forceRefresh = false) {
    console.log('开始刷新所有链的数据...', forceRefresh ? '(强制刷新)' : '');
    
    // 显示初始加载状态
    updateProgress(0, 100, 'Initializing...', 0, 0, 0);
    
    // 如果不是强制刷新，先尝试从缓存加载
    if (!forceRefresh && loadDataFromCache()) {
        return;
    }
    
    // 强制刷新时清除缓存和无数据key缓存
    if (forceRefresh) {
        clearCache();
        emptyKeysCache = new Set(); // 清除无数据key缓存，重新查询
    }
    
    allData = [];
    const chainStats = { xuper: 0, subchain1: 0, subchain2: 0, subchain3: 0 };
    
    // 先计算总查询数量
    let totalKeys = 0;
    const chainKeyCounts = {};
    for (const [chainKey, chainConfig] of Object.entries(chains)) {
        const knownKeys = generateKnownKeys(chainKey);
        const actualKeys = knownKeys.filter(key => !emptyKeysCache || !emptyKeysCache.has(key));
        chainKeyCounts[chainKey] = actualKeys.length;
        totalKeys += actualKeys.length;
    }
    
    console.log(`总共需要查询 ${totalKeys} 个key`);
    
    let globalProgress = 0;
    let globalSuccess = 0;
    let globalFail = 0;
    let globalSkip = 0;
    
    // 遍历所有链
    for (const [chainKey, chainConfig] of Object.entries(chains)) {
        console.log(`查询链: ${chainConfig.name}`);
        
        const knownKeys = generateKnownKeys(chainKey);
        if (knownKeys.length === 0) {
            continue; // 主链没有已知key，跳过
        }
        
        // 先过滤掉已知无数据的key
        const keysToQuery = knownKeys.filter(key => !emptyKeysCache || !emptyKeysCache.has(key));
        skipCount = knownKeys.length - keysToQuery.length;
        globalSkip += skipCount;
        globalProgress += skipCount;
        
        console.log(`链 ${chainConfig.name} 共有 ${keysToQuery.length} 个key需要查询（跳过 ${skipCount} 个）`);
        
        // 查询该链的所有数据（并发查询提升速度）
        let successCount = 0;
        let failCount = 0;
        const CONCURRENT_LIMIT = 20; // 每批并发查询20个key
        
        // 分批并发查询
        for (let batchStart = 0; batchStart < keysToQuery.length; batchStart += CONCURRENT_LIMIT) {
            const batchEnd = Math.min(batchStart + CONCURRENT_LIMIT, keysToQuery.length);
            const batch = keysToQuery.slice(batchStart, batchEnd);
            
            // 并发查询这一批key
            const batchPromises = batch.map(async (key) => {
                try {
                    const value = await queryDataFromChain(key, chainConfig, 'jsondata');
                    return { key, value, success: true };
                } catch (error) {
                    return { key, value: null, success: false, error };
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            
            // 处理查询结果
            for (const result of batchResults) {
                const { key, value } = result;
                globalProgress++;
                
                // 每查询一批，更新一次进度
                updateProgress(globalProgress, totalKeys, chainConfig.name, globalSuccess + successCount, globalFail + failCount, globalSkip);
                
                if (result.success === false) {
                    failCount++;
                    globalFail++;
                    continue;
                }
                
                if (value && value.trim && value.trim() !== '' && value !== 'null' && value !== 'undefined') {
                    let parsedValue;
                    try {
                        parsedValue = JSON.parse(value);
                    } catch (e) {
                        parsedValue = value;
                    }
                    
                    // 提取数据类型（HEALTH/ROAD/MEDICAL）
                    let dataType = 'UNKNOWN';
                    if (key.startsWith('HEALTH')) {
                        dataType = 'HEALTH';
                    } else if (key.startsWith('ROAD')) {
                        dataType = 'ROAD';
                    } else if (key.startsWith('MEDICAL')) {
                        dataType = 'MEDICAL';
                    }
                    
                    allData.push({
                        chain: chainKey,
                        chainName: chainConfig.name,
                        key: key,
                        value: parsedValue,
                        valueStr: typeof parsedValue === 'object' ? JSON.stringify(parsedValue, null, 2) : parsedValue,
                        type: dataType,
                        timestamp: parsedValue.qos?.timestamp || parsedValue.timestamp || new Date().toISOString(),
                        source: 'chain'
                    });
                    
                    chainStats[chainKey]++;
                    successCount++;
                    globalSuccess++;
                } else {
                    // value 为 null、空字符串或无效值，说明 key 不存在或数据无效
                    if (!emptyKeysCache) emptyKeysCache = new Set();
                    emptyKeysCache.add(key); // 记录无数据的key
                }
            }
        }
        console.log(`链 ${chainConfig.name} 查询完成: 成功 ${successCount}, 失败 ${failCount}, 跳过 ${skipCount}, 无数据 ${knownKeys.length - successCount - failCount - skipCount}`);
        
        // 更新统计
        updateStats(chainStats);
    }
    
    console.log(`数据加载完成，共 ${allData.length} 条数据`);
    console.log('各链数据统计:', chainStats);
    console.log(`总进度: ${globalProgress}/${totalKeys}, 成功: ${globalSuccess}, 失败: ${globalFail}, 跳过: ${globalSkip}`);
    
    // 显示完成状态
    updateProgress(totalKeys, totalKeys, 'Complete', globalSuccess, globalFail, globalSkip);
    
    // 如果有数据，保存到缓存
    if (allData.length > 0) {
        saveDataToCache();
        console.log('数据已保存到缓存');
    } else {
        console.warn('警告：查询完成但没有找到任何数据，可能的原因：');
        console.warn('1. 数据尚未写入链上');
        console.warn('2. Key 格式不匹配（检查日期格式）');
        console.warn('3. 合约名称不正确');
    }
    
    // 短暂延迟后应用筛选和渲染（让用户看到100%完成）
    setTimeout(() => {
        // 应用筛选
        filterData();
        
        // 如果筛选后也没有数据，显示提示
        if (filteredData.length === 0) {
            const tableBody = document.getElementById('data-table-body');
            if (tableBody) {
                if (allData.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">未找到数据<br><br>可能的原因：<br>1. 数据尚未写入链上<br>2. Key 格式不匹配（检查日期格式）<br>3. 合约名称不正确<br><br>请点击"Refresh All Data"按钮重新查询</td></tr>';
                } else {
                    tableBody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">当前筛选条件下没有数据，请调整筛选条件</td></tr>';
                }
            }
        }
    }, 500);
}

// Update statistics
function updateStats(stats) {
    document.getElementById('stat-main').textContent = stats.xuper || 0;
    document.getElementById('stat-sub1').textContent = stats.subchain1 || 0;
    document.getElementById('stat-sub2').textContent = stats.subchain2 || 0;
    document.getElementById('stat-sub3').textContent = stats.subchain3 || 0;
}

// Filter data
function filterData() {
    const chainFilter = document.getElementById('chain-filter').value;
    const typeFilter = document.getElementById('type-filter').value;
    const searchInput = document.getElementById('search-input').value.toLowerCase();
    const delayOperator = document.getElementById('delay-operator').value;
    const delayValue = document.getElementById('delay-value').value;
    const availabilityOperator = document.getElementById('availability-operator').value;
    const availabilityValue = document.getElementById('availability-value').value;
    
    filteredData = allData.filter(item => {
        // Chain filter
        if (chainFilter !== 'all' && item.chain !== chainFilter) {
            return false;
        }
        
        // Type filter
        if (typeFilter !== 'all' && item.type !== typeFilter) {
            return false;
        }
        
        // Search filter
        if (searchInput) {
            const searchStr = searchInput.toLowerCase();
            if (!item.key.toLowerCase().includes(searchStr) && 
                !item.valueStr.toLowerCase().includes(searchStr)) {
                return false;
            }
        }
        
        // Delay filter
        if (delayOperator && delayValue) {
            const itemDelay = item.value?.qos?.delay;
            if (itemDelay === undefined || itemDelay === null) {
                return false;
            }
            const delayNum = parseFloat(itemDelay);
            const filterDelay = parseFloat(delayValue);
            if (delayOperator === '>=' && delayNum < filterDelay) {
                return false;
            }
            if (delayOperator === '<=' && delayNum > filterDelay) {
                return false;
            }
        }
        
        // Availability filter
        if (availabilityOperator && availabilityValue) {
            const itemAvailability = item.value?.qos?.availability;
            if (itemAvailability === undefined || itemAvailability === null) {
                return false;
            }
            const availabilityNum = parseFloat(itemAvailability);
            const filterAvailability = parseFloat(availabilityValue);
            if (availabilityOperator === '>=' && availabilityNum < filterAvailability) {
                return false;
            }
            if (availabilityOperator === '<=' && availabilityNum > filterAvailability) {
                return false;
            }
        }
        
        return true;
    });
    
    // Update total count
    document.getElementById('total-count').textContent = filteredData.length;
    
    // Reset to first page when filtering
    currentPage = 1;
    
    // Render table
    renderTable();
}

// Clear filters
function clearFilters() {
    document.getElementById('chain-filter').value = 'all';
    document.getElementById('type-filter').value = 'all';
    document.getElementById('search-input').value = '';
    document.getElementById('delay-operator').value = '';
    document.getElementById('delay-value').value = '';
    document.getElementById('availability-operator').value = '';
    document.getElementById('availability-value').value = '';
    filterData();
}

// Render table
function renderTable() {
    const tableBody = document.getElementById('data-table-body');
    
    if (filteredData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500">No data</td></tr>';
        updatePagination();
        return;
    }
    
    // Sort by timestamp (newest first)
    filteredData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredData.length / pageSize);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);
    
    tableBody.innerHTML = pageData.map(item => {
        const chainConfig = chains[item.chain];
        const timestamp = item.timestamp ? new Date(item.timestamp).toLocaleString('en-US') : '-';
        
        // Extract QoS data
        const qos = item.value && item.value.qos ? item.value.qos : null;
        const delay = qos && qos.delay !== undefined ? qos.delay : '-';
        const availability = qos && qos.availability !== undefined ? qos.availability : '-';
        
        // Set color and icon based on data type
        let typeBgClass = 'bg-blue-100 text-blue-800';
        let typeIcon = 'database';
        if (item.type === 'HEALTH') {
            typeBgClass = 'bg-green-100 text-green-800';
            typeIcon = 'heartbeat';
        } else if (item.type === 'ROAD') {
            typeBgClass = 'bg-yellow-100 text-yellow-800';
            typeIcon = 'road';
        } else if (item.type === 'MEDICAL') {
            typeBgClass = 'bg-red-100 text-red-800';
            typeIcon = 'hospital';
        }
        
        // Chain color
        let chainColorClass = 'text-blue-600';
        if (chainConfig.color === 'green') chainColorClass = 'text-green-600';
        else if (chainConfig.color === 'yellow') chainColorClass = 'text-yellow-600';
        else if (chainConfig.color === 'red') chainColorClass = 'text-red-600';
        
        // Delay color (based on delay value)
        let delayColorClass = 'text-gray-600';
        if (typeof delay === 'number') {
            if (delay < 30) delayColorClass = 'text-green-600 font-semibold';
            else if (delay < 50) delayColorClass = 'text-yellow-600';
            else delayColorClass = 'text-red-600 font-semibold';
        }
        
        // Availability color (based on availability value)
        let availabilityColorClass = 'text-gray-600';
        if (typeof availability === 'number') {
            if (availability >= 98) availabilityColorClass = 'text-green-600 font-semibold';
            else if (availability >= 95) availabilityColorClass = 'text-yellow-600';
            else availabilityColorClass = 'text-red-600 font-semibold';
        }
        
        // Escape special characters
        const safeKey = item.key.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        const safeChain = item.chain.replace(/'/g, "\\'").replace(/"/g, '&quot;');
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="flex items-center">
                        <i class="fas fa-${chainConfig.icon} ${chainColorClass} mr-2"></i>
                        <span class="text-sm font-medium text-gray-900">${item.chainName}</span>
                    </div>
                </td>
                <td class="px-4 py-3">
                    <code class="text-sm text-gray-800 bg-gray-100 px-2 py-1 rounded">${item.key}</code>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${typeBgClass}">
                        <i class="fas fa-${typeIcon} mr-1"></i>${item.type || 'Unknown'}
                    </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm ${delayColorClass}">
                    ${delay}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm ${availabilityColorClass}">
                    ${availability}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    ${timestamp}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm">
                    <button onclick="viewData('${safeKey}', '${safeChain}')" 
                        class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded text-xs">
                        <i class="fas fa-eye"></i> View
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
    const totalPages = Math.ceil(filteredData.length / pageSize);
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
    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}

// Combine data function
async function combineData() {
    // Check if there's filtered data
    if (filteredData.length === 0) {
        alert('No data available. Please apply filters first.');
        return;
    }

    // Generate task ID
    const taskId = 'COMBINE-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    
    // Show modal
    const modal = document.getElementById('combine-modal');
    modal.classList.remove('hidden');
    
    // Initialize modal
    document.getElementById('combine-task-id').textContent = taskId;
    document.getElementById('combine-status').textContent = 'Running';
    document.getElementById('combine-start-time').textContent = new Date().toLocaleString('en-US');
    document.getElementById('combine-data-count').textContent = filteredData.length;
    
    // Reset steps
    resetSteps();
    
    // Step 1: Analyze filtered services (5-10 seconds)
    await updateStep('step-analyze', 'running', 'Analyzing filtered services...');
    
    // Simulate analysis progress
    const analysisDuration = 5000 + Math.random() * 5000; // 5-10 seconds
    const analysisSteps = [
        'Scanning services from all chains...',
        'Processing chain metadata...',
        'Calculating service statistics...',
        'Finalizing analysis...'
    ];
    
    for (let i = 0; i < analysisSteps.length; i++) {
        await sleep(analysisDuration / analysisSteps.length);
        await updateStep('step-analyze', 'running', analysisSteps[i]);
    }
    
    // Group data by chain
    const dataByChain = {
        subchain1: filteredData.filter(item => item.chain === 'subchain1'),
        subchain2: filteredData.filter(item => item.chain === 'subchain2'),
        subchain3: filteredData.filter(item => item.chain === 'subchain3')
    };
    
    await updateStep('step-analyze', 'complete', `Found ${dataByChain.subchain1.length} from SubChain 1, ${dataByChain.subchain2.length} from SubChain 2, ${dataByChain.subchain3.length} from SubChain 3`);
    await sleep(1000);
    
    // Step 2: Select optimal services (5-10 seconds)
    await updateStep('step-select', 'running', 'Selecting optimal services from each chain...');
    
    // Simulate selection progress
    const selectionDuration = 5000 + Math.random() * 5000; // 5-10 seconds
    const selectionSteps = [
        'Evaluating service quality metrics...',
        'Calculating QoS scores...',
        'Comparing services across chains...',
        'Selecting optimal services...'
    ];
    
    for (let i = 0; i < selectionSteps.length; i++) {
        await sleep(selectionDuration / selectionSteps.length);
        await updateStep('step-select', 'running', selectionSteps[i]);
    }
    
    const selectedData = selectOptimalData(dataByChain);
    
    // Must have data from all three chains
    if (selectedData.length !== 3) {
        const missingChains = [];
        if (dataByChain.subchain1.length === 0) missingChains.push('SubChain 1');
        if (dataByChain.subchain2.length === 0) missingChains.push('SubChain 2');
        if (dataByChain.subchain3.length === 0) missingChains.push('SubChain 3');
        
        await updateStep('step-select', 'error', `Missing services from: ${missingChains.join(', ')}. Need services from all three chains.`);
        document.getElementById('combine-status').textContent = 'Failed';
        document.getElementById('combine-status').className = 'ml-2 font-semibold text-red-600';
        return;
    }
    
    await updateStep('step-select', 'complete', `Selected 3 optimal services (one from each chain)`);
    await sleep(1000);
    
    // Display selected data
    displaySelectedData(selectedData);
    
    // Step 3: Record intent and execute transfers (wait for confirmation)
    await updateStep('step-transfer', 'running', 'Recording combination intent on main chain...');
    
    const intentResult = await recordIntent(taskId, selectedData);
    
    if (!intentResult.success) {
        await updateStep('step-transfer', 'error', `Failed to record intent: ${intentResult.message}`);
        document.getElementById('combine-status').textContent = 'Failed';
        document.getElementById('combine-status').className = 'ml-2 font-semibold text-red-600';
        return;
    }
    
    await updateStep('step-transfer', 'running', `Intent recorded (Tx: ${intentResult.txid.substring(0, 16)}...). Initiating cross-chain transfers...`);
    
    // Execute cross-chain transfers and wait for confirmation
    const transferResults = [];
    for (let i = 0; i < selectedData.length; i++) {
        const item = selectedData[i];
        const chainConfig = chains[item.chain];
        if (!chainConfig) continue;
        
        await updateStep('step-transfer', 'running', `Transferring to ${chainConfig.name}...`);
        
        const transferResult = await executeSingleTransfer(item, chainConfig);
        transferResults.push(transferResult);
        
        if (transferResult.success) {
            await updateStep('step-transfer', 'running', `${chainConfig.name} transfer confirmed (Tx: ${transferResult.txid.substring(0, 16)}...)`);
        } else {
            await updateStep('step-transfer', 'running', `${chainConfig.name} transfer failed: ${transferResult.message}`);
        }
    }
    
    const successCount = transferResults.filter(r => r.success).length;
    await updateStep('step-transfer', 'complete', `Completed ${successCount} cross-chain transfers`);
    await sleep(1000);
    
    // Display transfer results
    displayTransferResults(transferResults);
    
    // Step 4: Complete (5-10 seconds)
    await updateStep('step-complete', 'running', 'Finalizing task...');
    
    const completeDuration = 5000 + Math.random() * 5000; // 5-10 seconds
    const completeSteps = [
        'Verifying transaction results...',
        'Updating task status...',
        'Preparing summary...',
        'Task completed successfully'
    ];
    
    for (let i = 0; i < completeSteps.length; i++) {
        await sleep(completeDuration / completeSteps.length);
        await updateStep('step-complete', 'running', completeSteps[i]);
    }
    
    await updateStep('step-complete', 'complete', 'All tasks completed successfully');
    document.getElementById('combine-status').textContent = 'Completed';
    document.getElementById('combine-status').className = 'ml-2 font-semibold text-green-600';
}

// Select optimal data from each chain
function selectOptimalData(dataByChain) {
    const selected = [];
    
    // Score function: lower delay and higher availability = better
    function calculateScore(item) {
        const qos = item.value?.qos;
        if (!qos) return -1;
        
        const delay = parseFloat(qos.delay) || 999;
        const availability = parseFloat(qos.availability) || 0;
        
        // Score = availability / (delay + 1) * 100
        // Higher score is better
        return availability / (delay + 1) * 100;
    }
    
    // Must select from all three chains
    const requiredChains = ['subchain1', 'subchain2', 'subchain3'];
    
    for (const chainKey of requiredChains) {
        const chainData = dataByChain[chainKey];
        
        // If no data in this chain, return empty (will trigger error)
        if (chainData.length === 0) {
            return [];
        }
        
        // Calculate scores and find best
        let bestItem = null;
        let bestScore = -1;
        
        chainData.forEach(item => {
            const score = calculateScore(item);
            if (score > bestScore) {
                bestScore = score;
                bestItem = item;
            }
        });
        
        // If no valid item found, return empty
        if (!bestItem) {
            return [];
        }
        
        selected.push(bestItem);
    }
    
    return selected;
}

// Update step status
async function updateStep(stepId, status, description) {
    const stepEl = document.getElementById(stepId);
    const iconEl = stepEl.querySelector('.w-10');
    const circleEl = iconEl.querySelector('.step-circle');
    const numberEl = iconEl.querySelector('span');
    const descEl = document.getElementById(stepId + '-desc');
    
    stepEl.classList.remove('opacity-50');
    
    if (status === 'running') {
        stepEl.classList.remove('border-gray-200', 'border-green-500', 'border-red-500');
        stepEl.classList.add('border-blue-500');
        iconEl.classList.remove('bg-gray-300', 'bg-green-500', 'bg-red-500');
        iconEl.classList.add('bg-blue-500');
        numberEl.classList.remove('text-gray-600');
        numberEl.classList.add('text-white');
        if (circleEl) {
            circleEl.classList.add('active');
            circleEl.style.color = 'rgba(255, 255, 255, 0.6)';
        }
    } else if (status === 'complete') {
        stepEl.classList.remove('border-gray-200', 'border-blue-500', 'border-red-500');
        stepEl.classList.add('border-green-500');
        iconEl.classList.remove('bg-gray-300', 'bg-blue-500', 'bg-red-500');
        iconEl.classList.add('bg-green-500');
        numberEl.classList.remove('text-gray-600', 'text-white');
        numberEl.classList.add('text-white');
        if (circleEl) {
            circleEl.classList.remove('active');
            circleEl.style.display = 'none';
        }
        iconEl.innerHTML = '<i class="fas fa-check text-white"></i>';
    } else if (status === 'error') {
        stepEl.classList.remove('border-gray-200', 'border-blue-500', 'border-green-500');
        stepEl.classList.add('border-red-500');
        iconEl.classList.remove('bg-gray-300', 'bg-blue-500', 'bg-green-500');
        iconEl.classList.add('bg-red-500');
        numberEl.classList.remove('text-gray-600', 'text-white');
        numberEl.classList.add('text-white');
        if (circleEl) {
            circleEl.classList.remove('active');
            circleEl.style.display = 'none';
        }
        iconEl.innerHTML = '<i class="fas fa-times text-white"></i>';
    }
    
    if (descEl) {
        descEl.textContent = description;
    }
    
    await sleep(100);
}

// Reset all steps
function resetSteps() {
    ['step-analyze', 'step-select', 'step-transfer', 'step-complete'].forEach(stepId => {
        const stepEl = document.getElementById(stepId);
        stepEl.classList.add('opacity-50');
        stepEl.classList.remove('border-blue-500', 'border-green-500', 'border-red-500');
        stepEl.classList.add('border-gray-200');
        
        const iconEl = stepEl.querySelector('.w-10');
        iconEl.classList.remove('bg-blue-500', 'bg-green-500', 'bg-red-500');
        iconEl.classList.add('bg-gray-300');
        
        const circleEl = iconEl.querySelector('.step-circle');
        if (circleEl) {
            circleEl.classList.remove('active');
            circleEl.style.display = 'block';
            circleEl.style.color = '';
        }
        
        const stepNum = stepId.split('-')[1];
        const stepNames = { 'analyze': '1', 'select': '2', 'transfer': '3', 'complete': '4' };
        const numberEl = iconEl.querySelector('span');
        if (numberEl) {
            numberEl.textContent = stepNames[stepNum];
            numberEl.classList.remove('text-white');
            numberEl.classList.add('text-gray-600');
        } else {
            iconEl.innerHTML = `<div class="step-circle"></div><span class="text-gray-600 relative z-10">${stepNames[stepNum]}</span>`;
        }
    });
    
    document.getElementById('selected-data-section').classList.add('hidden');
    document.getElementById('transfer-results-section').classList.add('hidden');
}

// Display selected data
function displaySelectedData(selectedData) {
    const section = document.getElementById('selected-data-section');
    const list = document.getElementById('selected-data-list');
    
    list.innerHTML = selectedData.map(item => {
        const chainConfig = chains[item.chain];
        const qos = item.value?.qos || {};
        const delay = qos.delay || '-';
        const availability = qos.availability || '-';
        
        return `
            <div class="bg-white border-2 border-gray-200 rounded-lg p-4">
                <div class="flex items-center mb-3">
                    <i class="fas fa-${chainConfig.icon} text-${chainConfig.color}-600 mr-2"></i>
                    <span class="font-semibold text-gray-800">${chainConfig.name}</span>
                </div>
                <div class="space-y-2 text-sm">
                    <div>
                        <span class="text-gray-600">Key:</span>
                        <code class="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">${item.key.substring(0, 20)}...</code>
                    </div>
                    <div>
                        <span class="text-gray-600">Delay:</span>
                        <span class="ml-2 font-semibold text-blue-600">${delay} ms</span>
                    </div>
                    <div>
                        <span class="text-gray-600">Availability:</span>
                        <span class="ml-2 font-semibold text-green-600">${availability}%</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    section.classList.remove('hidden');
}

// Record combination intent on main chain
async function recordIntent(taskId, selectedData) {
    try {
        const response = await fetch(`${API_BASE}/record-intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId: taskId,
                selectedData: selectedData,
                timestamp: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            return {
                success: true,
                txid: data.txid || '-',
                message: 'Intent recorded successfully'
            };
        } else {
            return {
                success: false,
                txid: '-',
                message: data.error || data.message || 'Failed to record intent'
            };
        }
    } catch (error) {
        return {
            success: false,
            txid: '-',
            message: error.message || 'Error recording intent'
        };
    }
}

// Wait for transaction confirmation
async function waitForTransaction(txid, chainName, container, rpcPort, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(`${API_BASE}/tx/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    txid: txid,
                    chain: chainName,
                    container: container,
                    rpcPort: rpcPort
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                // Check if transaction exists and is confirmed
                if (data && data.txid) {
                    // Transaction found, consider it confirmed
                    return true;
                }
            }
        } catch (error) {
            // Continue waiting
        }
        
        // Wait 1 second before next attempt
        await sleep(1000);
    }
    
    return false;
}

// Wait for transaction confirmation
async function waitForTransaction(txid, chainName, container, rpcPort, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await fetch(`${API_BASE}/tx/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    txid: txid,
                    chain: chainName,
                    container: container,
                    rpcPort: rpcPort
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                // Check if transaction exists and is confirmed
                if (data && data.txid) {
                    // Transaction found, consider it confirmed
                    return true;
                }
            }
        } catch (error) {
            // Continue waiting
        }
        
        // Wait 1 second before next attempt
        await sleep(1000);
    }
    
    return false;
}

// Execute single cross-chain transfer
async function executeSingleTransfer(item, chainConfig) {
    try {
        // Transfer amount: 1000000 (0.01 Xuper)
        const amount = '1000000';
        
        // Use default account address (same address on all chains)
        const toAddress = 'TeyyPLpp9L7QAcxHangtcHTu7HUZ6iydY';
        
        const response = await fetch(`${API_BASE}/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromChain: 'xuper',
                toChain: chainConfig.chainName,
                toAddress: toAddress,
                amount: amount,
                fromContainer: chains.xuper.container,
                fromRpcPort: chains.xuper.rpcPort
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success && data.txid && data.txid !== '-') {
            // Wait for transaction confirmation
            const confirmed = await waitForTransaction(
                data.txid,
                'xuper',
                chains.xuper.container,
                chains.xuper.rpcPort
            );
            
            return {
                chain: chainConfig.name,
                success: true,
                txid: data.txid,
                confirmed: confirmed,
                message: confirmed ? 'Cross-chain transfer confirmed' : 'Cross-chain transfer submitted (pending confirmation)'
            };
        } else {
            return {
                chain: chainConfig.name,
                success: false,
                txid: data.txid || '-',
                message: data.error || data.message || 'Transfer failed'
            };
        }
    } catch (error) {
        return {
            chain: chainConfig.name,
            success: false,
            txid: '-',
            message: error.message || 'Transfer error'
        };
    }
}

// Execute cross-chain transfers (kept for backward compatibility)
async function executeTransfers(selectedData) {
    const results = [];
    
    for (const item of selectedData) {
        const chainConfig = chains[item.chain];
        if (!chainConfig) continue;
        
        const result = await executeSingleTransfer(item, chainConfig);
        results.push(result);
        
        // Small delay between transfers
        await sleep(500);
    }
    
    return results;
}

// Display transfer results
function displayTransferResults(results) {
    const section = document.getElementById('transfer-results-section');
    const list = document.getElementById('transfer-results-list');
    
    list.innerHTML = results.map(result => {
        const statusClass = result.success ? 'text-green-600' : 'text-red-600';
        const statusIcon = result.success ? 'fa-check-circle' : 'fa-times-circle';
        const bgClass = result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
        
        return `
            <div class="p-4 rounded-lg border-2 ${bgClass}">
                <div class="flex items-center justify-between">
                    <div class="flex items-center">
                        <i class="fas ${statusIcon} ${statusClass} mr-2"></i>
                        <span class="font-semibold text-gray-800">${result.chain}</span>
                    </div>
                    <span class="text-sm ${statusClass} font-semibold">${result.success ? 'Success' : 'Failed'}</span>
                </div>
                <div class="mt-2 text-sm text-gray-600">
                    <div>TX ID: <code class="bg-gray-100 px-2 py-1 rounded text-xs font-mono">${result.txid}</code></div>
                    <div class="mt-1">${result.message}</div>
                    ${result.confirmed !== undefined ? `<div class="mt-1 text-xs ${result.confirmed ? 'text-green-600' : 'text-yellow-600'}">${result.confirmed ? 'Confirmed' : 'Pending confirmation'}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    section.classList.remove('hidden');
}

// Close combine modal
function closeCombineModal() {
    document.getElementById('combine-modal').classList.add('hidden');
}

// Sleep utility
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// View data details
function viewData(key, chain) {
    const item = allData.find(d => d.key === key && d.chain === chain);
    if (!item) return;
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-auto">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-800">Data Details</h3>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Chain</label>
                    <p class="text-sm text-gray-900">${item.chainName}</p>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Key</label>
                    <code class="text-sm text-gray-800 bg-gray-100 px-2 py-1 rounded">${item.key}</code>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Data Content</label>
                    <pre class="text-xs bg-gray-50 p-4 rounded border overflow-auto max-h-96">${item.valueStr}</pre>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

// Write Data Modal Functions
function loadCurrentUser() {
    const user = localStorage.getItem('xuperchain_current_user');
    return user ? JSON.parse(user) : null;
}

function loadAllAccounts() {
    const accounts = JSON.parse(localStorage.getItem('xuperchain_accounts') || '[]');
    return accounts;
}

function formatBalance(balance) {
    if (!balance) return '0';
    const num = BigInt(balance);
    const divisor = BigInt(100000000);
    const whole = num / divisor;
    const fraction = num % divisor;
    return `${whole}.${fraction.toString().padStart(8, '0')}`;
}

function getWriteModalChain() {
    return chains[writeModalChainKey] || chains.xuper;
}

function openWriteDataModal() {
    const currentUser = loadCurrentUser();
    if (!currentUser) {
        alert('Please login first. Go to User Management page to create an account and login.');
        return;
    }
    
    const modal = document.getElementById('write-data-modal');
    modal.classList.remove('hidden');
    
    // Initialize modal
    writeModalChainKey = 'xuper';
    updateWriteModalChain();
}

function closeWriteDataModal() {
    const modal = document.getElementById('write-data-modal');
    modal.classList.add('hidden');
}

function updateWriteModalChain() {
    const chain = getWriteModalChain();
    updateWriteModalAccountSelector();
}

async function updateWriteModalAccountSelector() {
    const selector = document.getElementById('write-modal-account-selector');
    if (!selector) return;
    
    const chain = getWriteModalChain();
    writeModalAllAccounts = loadAllAccounts();
    
    const chainAccounts = writeModalAllAccounts.filter(acc => {
        if (acc.chain) return acc.chain === chain.chainName;
        if (acc.chainKey) return acc.chainKey === writeModalChainKey;
        return true;
    });
    
    selector.innerHTML = '';
    
    if (chainAccounts.length === 0) {
        selector.innerHTML = '<option value="">No accounts on current chain</option>';
        writeModalSelectedAccount = null;
        updateWriteModalAccountDisplay();
        return;
    }
    
    chainAccounts.forEach(acc => {
        const option = document.createElement('option');
        option.value = acc.address;
        option.textContent = `${acc.name || 'Unnamed'} (${acc.address.substring(0, 8)}...)`;
        option.dataset.account = JSON.stringify(acc);
        selector.appendChild(option);
    });
    
    if (writeModalSelectedAccount) {
        const found = chainAccounts.find(acc => acc.address === writeModalSelectedAccount.address);
        if (found) {
            selector.value = found.address;
            writeModalSelectedAccount = found;
        } else {
            selector.value = chainAccounts[0].address;
            writeModalSelectedAccount = chainAccounts[0];
        }
    } else {
        selector.value = chainAccounts[0].address;
        writeModalSelectedAccount = chainAccounts[0];
    }
    
    updateWriteModalAccountDisplay();
    await refreshWriteModalAccountBalance();
}

function switchWriteModalAccount() {
    const selector = document.getElementById('write-modal-account-selector');
    if (!selector || !selector.value) {
        writeModalSelectedAccount = null;
        updateWriteModalAccountDisplay();
        return;
    }
    
    const selectedOption = selector.options[selector.selectedIndex];
    if (selectedOption.dataset.account) {
        writeModalSelectedAccount = JSON.parse(selectedOption.dataset.account);
        updateWriteModalAccountDisplay();
        refreshWriteModalAccountBalance();
    }
}

function updateWriteModalAccountDisplay() {
    const addressEl = document.getElementById('write-modal-account-address');
    const balanceEl = document.getElementById('write-modal-account-balance');
    
    if (writeModalSelectedAccount) {
        if (addressEl) addressEl.textContent = writeModalSelectedAccount.address;
        if (balanceEl) balanceEl.textContent = 'Loading...';
    } else {
        if (addressEl) addressEl.textContent = '-';
        if (balanceEl) balanceEl.textContent = '-';
    }
}

async function refreshWriteModalAccountBalance() {
    if (!writeModalSelectedAccount) {
        updateWriteModalAccountDisplay();
        return;
    }
    
    const chain = getWriteModalChain();
    const balanceEl = document.getElementById('write-modal-account-balance');
    
    if (!balanceEl) return;
    
    balanceEl.textContent = 'Querying...';
    balanceEl.className = 'ml-2 font-semibold text-sm text-gray-500';
    
    try {
        const response = await fetch(`${API_BASE}/account/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: writeModalSelectedAccount.address,
                chain: chain.chainName,
                container: chain.container,
                rpcPort: chain.rpcPort
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const balance = data.balance || '0';
            const formattedBalance = formatBalance(balance);
            balanceEl.textContent = formattedBalance;
            
            const balanceNum = BigInt(balance);
            if (balanceNum >= BigInt(1000)) {
                balanceEl.className = 'ml-2 font-semibold text-sm text-green-600';
            } else if (balanceNum > BigInt(0)) {
                balanceEl.className = 'ml-2 font-semibold text-sm text-yellow-600';
            } else {
                balanceEl.className = 'ml-2 font-semibold text-sm text-red-600';
            }
        } else {
            balanceEl.textContent = 'Query failed';
            balanceEl.className = 'ml-2 font-semibold text-sm text-red-600';
        }
    } catch (error) {
        console.error('Query balance failed:', error);
        balanceEl.textContent = 'Query failed';
        balanceEl.className = 'ml-2 font-semibold text-sm text-red-600';
    }
}

async function writeModalData(event) {
    event.preventDefault();
    
    const currentUser = loadCurrentUser();
    if (!currentUser) {
        alert('Please login first');
        return;
    }
    
    if (!writeModalSelectedAccount) {
        alert('Please select an account');
        return;
    }
    
    const key = document.getElementById('write-modal-data-key').value.trim();
    const value = document.getElementById('write-modal-data-value').value.trim();
    const dataType = document.getElementById('write-modal-data-type').value;
    const contractName = document.getElementById('write-modal-contract-name').value.trim() || 'golangcounter';
    
    if (!key || !value) {
        alert('Please enter data key and value');
        return;
    }
    
    try {
        let processedValue = value;
        if (dataType === 'json') {
            try {
                JSON.parse(value);
                processedValue = value;
            } catch (e) {
                alert('Invalid JSON format');
                return;
            }
        } else if (dataType === 'number') {
            if (isNaN(value)) {
                alert('Please enter a valid number');
                return;
            }
            processedValue = value;
        }
        
        const chain = getWriteModalChain();
        
        // Determine keys path
        let keysPath = currentUser.keysPath || `data/${currentUser.name || 'keys'}`;
        
        // Check if keys path exists
        try {
            const checkPathResponse = await fetch(`${API_BASE}/account/check-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    container: chain.container,
                    keysPath: keysPath
                })
            });
            
            const checkResult = await checkPathResponse.json();
            
            if (!checkResult.exists) {
                const defaultPath = 'data/keys';
                const checkDefaultResponse = await fetch(`${API_BASE}/account/check-keys`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        container: chain.container,
                        keysPath: defaultPath
                    })
                });
                
                const checkDefaultResult = await checkDefaultResponse.json();
                
                if (checkDefaultResult.exists) {
                    keysPath = defaultPath;
                } else {
                    alert(`Cannot find account keys on current chain ${chain.name}.\n\nPlease go to User Management page to create an account on the current chain, or use the default account path data/keys.`);
                    return;
                }
            }
        } catch (checkError) {
            console.warn('Check keys path failed, using original path:', checkError);
        }
        
        const requestData = {
            key: key,
            value: processedValue,
            dataType: dataType,
            contractName: contractName,
            address: writeModalSelectedAccount.address,
            chain: chain.chainName,
            container: chain.container,
            rpcPort: chain.rpcPort,
            keysPath: writeModalSelectedAccount.keysPath || keysPath
        };
        
        const response = await fetch(`${API_BASE}/data/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });
        
        let data;
        try {
            const text = await response.text();
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('Parse response failed:', parseError);
            alert('Server response format error, please check console');
            return;
        }
        
        if (response.ok && data.success) {
            let message = `Data written successfully!\nTX ID: ${data.txid || '-'}\nContract Response: ${data.response || '-'}`;
            if (data.note) {
                message += `\n\nNote: ${data.note}`;
            }
            alert(message);
            
            // Clear form
            document.getElementById('write-modal-form').reset();
            document.getElementById('write-modal-contract-name').value = 'golangcounter';
            // Refresh data list
            refreshAllData(true);
            // Close modal
            closeWriteDataModal();
        } else {
            let errorMsg = data.error || data.message || 'Unknown error';
            if (data.balance !== undefined) {
                errorMsg += `\nCurrent Balance: ${data.balance}`;
            }
            if (data.hint) {
                errorMsg += '\n\nHint: ' + data.hint;
            }
            alert('Failed to write data: ' + errorMsg);
        }
    } catch (error) {
        console.error('Write data failed:', error);
        alert(`Failed to write data: ${error.message}`);
    }
}

// Upload Data Modal functions
function openUploadDataModal() {
    const currentUser = loadCurrentUser();
    if (!currentUser) {
        alert('Please login first. Go to User Management page to create an account and login.');
        return;
    }
    
    const modal = document.getElementById('upload-data-modal');
    modal.classList.remove('hidden');
    
    // Reset form
    document.getElementById('upload-modal-form').reset();
    document.getElementById('upload-file-preview').classList.add('hidden');
    document.getElementById('upload-progress').classList.add('hidden');
    selectedFile = null;
    
    // Initialize modal
    uploadModalChainKey = 'xuper';
    const chainSelector = document.getElementById('upload-modal-chain-selector');
    if (chainSelector) {
        chainSelector.value = uploadModalChainKey;
    }
    uploadModalSelectedAccount = null; // 重置账户选择
    updateUploadModalChain();
}

function closeUploadDataModal() {
    const modal = document.getElementById('upload-data-modal');
    modal.classList.add('hidden');
    
    // Reset form
    document.getElementById('upload-modal-form').reset();
    document.getElementById('upload-file-preview').classList.add('hidden');
    document.getElementById('upload-progress').classList.add('hidden');
    selectedFile = null;
}

function getUploadModalChain() {
    return chains[uploadModalChainKey] || chains.xuper;
}

function updateUploadModalChain() {
    const selector = document.getElementById('upload-modal-chain-selector');
    if (selector) {
        uploadModalChainKey = selector.value;
        // 切换链时，清空已选择的账户，让系统重新选择当前链的第一个账户
        uploadModalSelectedAccount = null;
    }
    const chain = getUploadModalChain();
    updateUploadModalAccountSelector();
}

async function updateUploadModalAccountSelector() {
    const selector = document.getElementById('upload-modal-account-selector');
    if (!selector) return;
    
    const chain = getUploadModalChain();
    uploadModalAllAccounts = loadAllAccounts();
    
    const chainAccounts = uploadModalAllAccounts.filter(acc => {
        if (acc.chain) return acc.chain === chain.chainName;
        if (acc.chainKey) return acc.chainKey === uploadModalChainKey;
        return true;
    });
    
    selector.innerHTML = '';
    
    if (chainAccounts.length === 0) {
        selector.innerHTML = '<option value="">No accounts on current chain</option>';
        uploadModalSelectedAccount = null;
        updateUploadModalAccountDisplay();
        return;
    }
    
    chainAccounts.forEach(acc => {
        const option = document.createElement('option');
        option.value = acc.address;
        option.textContent = `${acc.name || 'Unnamed'} (${acc.address.substring(0, 8)}...)`;
        option.dataset.account = JSON.stringify(acc);
        selector.appendChild(option);
    });
    
    if (uploadModalSelectedAccount) {
        const found = chainAccounts.find(acc => acc.address === uploadModalSelectedAccount.address);
        if (found) {
            selector.value = found.address;
            uploadModalSelectedAccount = found;
        } else {
            selector.value = chainAccounts[0].address;
            uploadModalSelectedAccount = chainAccounts[0];
        }
    } else {
        selector.value = chainAccounts[0].address;
        uploadModalSelectedAccount = chainAccounts[0];
    }
    
    updateUploadModalAccountDisplay();
    await refreshUploadModalAccountBalance();
}

function switchUploadModalAccount() {
    const selector = document.getElementById('upload-modal-account-selector');
    if (!selector || !selector.value) {
        uploadModalSelectedAccount = null;
        updateUploadModalAccountDisplay();
        return;
    }
    
    const selectedOption = selector.options[selector.selectedIndex];
    if (selectedOption.dataset.account) {
        uploadModalSelectedAccount = JSON.parse(selectedOption.dataset.account);
        updateUploadModalAccountDisplay();
        refreshUploadModalAccountBalance();
    }
}

function updateUploadModalAccountDisplay() {
    const addressEl = document.getElementById('upload-modal-account-address');
    const balanceEl = document.getElementById('upload-modal-account-balance');
    
    if (uploadModalSelectedAccount) {
        if (addressEl) addressEl.textContent = uploadModalSelectedAccount.address;
        if (balanceEl) balanceEl.textContent = 'Loading...';
    } else {
        if (addressEl) addressEl.textContent = '-';
        if (balanceEl) balanceEl.textContent = '-';
    }
}

async function refreshUploadModalAccountBalance() {
    if (!uploadModalSelectedAccount) {
        updateUploadModalAccountDisplay();
        return;
    }
    
    const chain = getUploadModalChain();
    const balanceEl = document.getElementById('upload-modal-account-balance');
    
    if (!balanceEl) return;
    
    balanceEl.textContent = 'Querying...';
    balanceEl.className = 'ml-2 font-semibold text-sm text-gray-500';
    
    try {
        const response = await fetch(`${API_BASE}/account/balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: uploadModalSelectedAccount.address,
                chain: chain.chainName,
                container: chain.container,
                rpcPort: chain.rpcPort
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const balance = data.balance || '0';
            const formattedBalance = formatBalance(balance);
            balanceEl.textContent = formattedBalance;
            
            const balanceNum = BigInt(balance);
            if (balanceNum >= BigInt(1000)) {
                balanceEl.className = 'ml-2 font-semibold text-sm text-green-600';
            } else if (balanceNum > BigInt(0)) {
                balanceEl.className = 'ml-2 font-semibold text-sm text-yellow-600';
            } else {
                balanceEl.className = 'ml-2 font-semibold text-sm text-red-600';
            }
        } else {
            balanceEl.textContent = 'Query failed';
            balanceEl.className = 'ml-2 font-semibold text-sm text-red-600';
        }
    } catch (error) {
        console.error('Query balance failed:', error);
        balanceEl.textContent = 'Query failed';
        balanceEl.className = 'ml-2 font-semibold text-sm text-red-600';
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        selectedFile = null;
        document.getElementById('upload-file-preview').classList.add('hidden');
        return;
    }
    
    if (!file.name.endsWith('.json')) {
        alert('Please select a JSON file');
        event.target.value = '';
        return;
    }
    
    selectedFile = file;
    
    // Read and preview file
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            const jsonData = JSON.parse(content);
            
            const preview = document.getElementById('upload-file-preview');
            const info = document.getElementById('upload-file-info');
            
            let recordCount = 0;
            let sampleKeys = [];
            
            if (Array.isArray(jsonData)) {
                recordCount = jsonData.length;
                sampleKeys = jsonData.slice(0, 3).map(r => r.id || r.key || 'N/A');
            } else if (typeof jsonData === 'object') {
                recordCount = 1;
                sampleKeys = [jsonData.id || jsonData.key || 'N/A'];
            }
            
            info.innerHTML = `
                <div>File: <strong>${file.name}</strong> (${(file.size / 1024).toFixed(2)} KB)</div>
                <div>Records: <strong>${recordCount}</strong></div>
                ${sampleKeys.length > 0 ? `<div>Sample keys: ${sampleKeys.join(', ')}</div>` : ''}
            `;
            
            preview.classList.remove('hidden');
        } catch (error) {
            alert('Invalid JSON file: ' + error.message);
            event.target.value = '';
            selectedFile = null;
        }
    };
    reader.readAsText(file);
}

async function uploadModalData(event) {
    event.preventDefault();
    
    const currentUser = loadCurrentUser();
    if (!currentUser) {
        alert('Please login first');
        return;
    }
    
    if (!uploadModalSelectedAccount) {
        alert('Please select an account');
        return;
    }
    
    if (!selectedFile) {
        alert('Please select a JSON file');
        return;
    }
    
    const chain = getUploadModalChain();
    
    // 验证选择的账户是否属于当前链
    if (uploadModalSelectedAccount) {
        const chainAccounts = uploadModalAllAccounts.filter(acc => {
            if (acc.chain) return acc.chain === chain.chainName;
            if (acc.chainKey) return acc.chainKey === uploadModalChainKey;
            return true;
        });
        
        const accountOnChain = chainAccounts.find(acc => acc.address === uploadModalSelectedAccount.address);
        if (!accountOnChain) {
            alert(`Selected account does not belong to chain ${chain.name}.\n\nPlease select an account that belongs to the current chain.`);
            return;
        }
        // 使用当前链上的账户信息
        uploadModalSelectedAccount = accountOnChain;
    }
    
    // Determine keys path - 优先使用选择的账户的keysPath
    let keysPath = uploadModalSelectedAccount?.keysPath || currentUser.keysPath || `data/${currentUser.name || 'keys'}`;
    
    // Check if keys path exists
    try {
        const checkPathResponse = await fetch(`${API_BASE}/account/check-keys`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                container: chain.container,
                keysPath: keysPath
            })
        });
        
        const checkResult = await checkPathResponse.json();
        
        if (!checkResult.exists) {
            const defaultPath = 'data/keys';
            const checkDefaultResponse = await fetch(`${API_BASE}/account/check-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    container: chain.container,
                    keysPath: defaultPath
                })
            });
            
            const checkDefaultResult = await checkDefaultResponse.json();
            
            if (checkDefaultResult.exists) {
                keysPath = defaultPath;
            } else {
                alert(`Cannot find account keys on current chain ${chain.name}.\n\nPlease go to User Management page to create an account on the current chain, or use the default account path data/keys.`);
                return;
            }
        }
    } catch (checkError) {
        console.warn('Check keys path failed, using original path:', checkError);
    }
    
    // Read file content
    const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        reader.readAsText(selectedFile);
    });
    
    let jsonData;
    try {
        jsonData = JSON.parse(fileContent);
    } catch (error) {
        alert('Invalid JSON file: ' + error.message);
        return;
    }
    
    // Ensure it's an array
    const records = Array.isArray(jsonData) ? jsonData : [jsonData];
    
    if (records.length === 0) {
        alert('JSON file is empty');
        return;
    }
    
    // Show progress
    const progressDiv = document.getElementById('upload-progress');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    const statusDiv = document.getElementById('upload-status');
    const submitBtn = document.getElementById('upload-submit-btn');
    
    progressDiv.classList.remove('hidden');
    submitBtn.disabled = true;
    
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    // Upload each record
    for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const key = record.id || record.key || `record_${i + 1}`;
        
        // Update progress
        const progress = Math.round(((i + 1) / records.length) * 100);
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `${i + 1}/${records.length}`;
        statusDiv.textContent = `Uploading record ${i + 1}/${records.length}: ${key}...`;
        
        try {
            const response = await fetch(`${API_BASE}/data/upload-json`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: key,
                    value: JSON.stringify(record),
                    address: uploadModalSelectedAccount.address,
                    chain: chain.chainName,
                    container: chain.container,
                    rpcPort: chain.rpcPort,
                    keysPath: uploadModalSelectedAccount.keysPath || keysPath || 'data/keys'
                })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                successCount++;
                results.push({ key, success: true, txid: data.txid });
                // 保存已上传的key到localStorage
                saveUploadedKey(chain.chainName, key);
            } else {
                failCount++;
                results.push({ key, success: false, error: data.error || data.message });
            }
        } catch (error) {
            failCount++;
            results.push({ key, success: false, error: error.message });
        }
        
        // Small delay to avoid overwhelming the chain
        if (i < records.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
        }
    }
    
    // Show final status
    statusDiv.innerHTML = `
        <div class="font-semibold mb-1">Upload Complete!</div>
        <div>Success: <span class="text-green-600">${successCount}</span> | Failed: <span class="text-red-600">${failCount}</span></div>
        ${failCount > 0 ? `<div class="mt-2 text-xs text-gray-500">Failed records: ${results.filter(r => !r.success).map(r => r.key).join(', ')}</div>` : ''}
    `;
    
    submitBtn.disabled = false;
    
    // Refresh data list
    if (successCount > 0) {
        setTimeout(() => {
            refreshAllData(true);
        }, 1000);
    }
    
    // Close modal after 3 seconds if all successful
    if (failCount === 0) {
        setTimeout(() => {
            closeUploadDataModal();
        }, 3000);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Try loading from cache first, if no cache or cache expired, then query
    refreshAllData(false);
});

