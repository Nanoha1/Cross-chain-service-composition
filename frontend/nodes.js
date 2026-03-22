// API代理地址
const API_BASE = 'http://localhost:3000/api';

// Fetch all node information
async function fetchNodes() {
    try {
        const response = await fetch(`${API_BASE}/nodes`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch node information:', error);
        return { total: 0, nodes: [] };
    }
}

// Update statistics
function updateStatistics(nodes) {
    const total = nodes.length;
    const running = nodes.filter(n => n.status === 'Running').length;
    const offline = nodes.filter(n => n.status === 'Offline' || n.status === 'Error').length;
    const totalHeight = nodes.reduce((sum, n) => {
        const height = typeof n.height === 'number' ? n.height : 0;
        return sum + height;
    }, 0);

    document.getElementById('total-nodes').textContent = total;
    document.getElementById('running-nodes').textContent = running;
    document.getElementById('offline-nodes').textContent = offline;
    document.getElementById('total-height').textContent = totalHeight.toLocaleString();
}

// Render node table
function renderNodesTable(nodes) {
    const tbody = document.getElementById('nodes-table-body');
    
    if (nodes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-8 text-center text-gray-500">
                    <i class="fas fa-inbox mr-2"></i>No running nodes
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = nodes.map(node => {
        const statusClass = node.status === 'Running' 
            ? 'bg-green-100 text-green-800' 
            : node.status === 'Error'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-red-100 text-red-800';
        
        const statusIcon = node.status === 'Running' 
            ? '<i class="fas fa-check-circle"></i>' 
            : node.status === 'Error'
            ? '<i class="fas fa-exclamation-triangle"></i>'
            : '<i class="fas fa-times-circle"></i>';
        
        const chainBadgeClass = node.chain === 'xuper'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-blue-100 text-blue-800';
        
        const tipBlockid = node.tipBlockid && node.tipBlockid !== '-'
            ? node.tipBlockid.substring(0, 16) + '...'
            : '-';
        
        return `
            <tr class="table-row-hover">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="w-3 h-3 rounded-full ${node.status === 'Running' ? 'bg-green-500 pulse-ring' : 'bg-red-500'} mr-3"></div>
                        <span class="font-medium text-gray-900">${node.name}</span>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${chainBadgeClass}">
                        ${node.chain}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <code class="bg-gray-100 px-2 py-1 rounded text-xs">${node.container}</code>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="font-mono">${node.rpcPort}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span class="font-mono">${node.p2pPort}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm font-semibold text-gray-900">${node.height}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-3 py-1 text-xs font-semibold rounded-full ${statusClass}">
                        ${statusIcon} ${node.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <code class="bg-gray-100 px-2 py-1 rounded text-xs">${tipBlockid}</code>
                </td>
            </tr>
        `;
    }).join('');
}

// Refresh node information
async function refreshNodes() {
    document.getElementById('last-update').textContent = new Date().toLocaleTimeString('en-US');
    
    const data = await fetchNodes();
    updateStatistics(data.nodes);
    renderNodesTable(data.nodes);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Node management page loaded, starting to fetch node information...');
    refreshNodes();
    // Auto refresh every 10 seconds
    setInterval(refreshNodes, 10000);
});

