class WarrantyLookupApp {
    constructor() {
        this.currentResults = [];
        this.filteredResults = [];
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.sortColumn = '';
        this.sortDirection = 'asc';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateStats();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // File upload
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');

        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadZone.addEventListener('drop', this.handleFileDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));

        // Manual input
        document.getElementById('checkManualBtn').addEventListener('click', this.checkManualWarranty.bind(this));
        document.getElementById('clearBtn').addEventListener('click', this.clearManualInput.bind(this));

        // Results actions
        document.getElementById('exportBtn').addEventListener('click', this.exportResults.bind(this));
        document.getElementById('newCheckBtn').addEventListener('click', this.resetApp.bind(this));

        // Filters
        document.getElementById('statusFilter').addEventListener('change', this.applyFilters.bind(this));
        document.getElementById('searchFilter').addEventListener('input', this.applyFilters.bind(this));

        // Table sorting
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', (e) => this.handleSort(e.target.dataset.sort));
        });

        // Pagination
        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));

        // Modal
        document.getElementById('modalClose').addEventListener('click', this.closeModal.bind(this));
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    // File Upload Handlers
    handleDragOver(e) {
        e.preventDefault();
        document.getElementById('uploadZone').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.getElementById('uploadZone').classList.remove('dragover');
    }

    handleFileDrop(e) {
        e.preventDefault();
        document.getElementById('uploadZone').classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    async processFile(file) {
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (file.size > maxSize) {
            this.showToast('File too large. Maximum size is 5MB.', 'error');
            return;
        }

        const allowedTypes = ['text/csv', 'text/plain', 'application/csv'];
        const allowedExtensions = ['.csv', '.txt'];
        
        const hasValidType = allowedTypes.includes(file.type);
        const hasValidExtension = allowedExtensions.some(ext => 
            file.name.toLowerCase().endsWith(ext)
        );

        if (!hasValidType && !hasValidExtension) {
            this.showToast('Invalid file type. Only CSV and TXT files are allowed.', 'error');
            return;
        }

        this.showUploadProgress(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload/parse', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.showToast(`Successfully loaded ${result.totalFound} serial numbers`, 'success');
                
                // Switch to manual tab and populate textarea
                document.getElementById('serialTextarea').value = result.serialNumbers.join('\n');
                this.switchTab('manual');
                
                if (result.errors && result.errors.length > 0) {
                    console.warn('File parsing warnings:', result.errors);
                }
            } else {
                this.showToast(result.message || 'Failed to parse file', 'error');
            }
        } catch (error) {
            console.error('File upload error:', error);
            this.showToast('Failed to upload file. Please try again.', 'error');
        } finally {
            this.showUploadProgress(false);
        }
    }

    showUploadProgress(show) {
        const uploadContent = document.querySelector('.upload-content');
        const uploadProgress = document.getElementById('uploadProgress');
        
        if (show) {
            uploadContent.style.display = 'none';
            uploadProgress.classList.remove('hidden');
        } else {
            uploadContent.style.display = 'block';
            uploadProgress.classList.add('hidden');
        }
    }

    // Manual Warranty Check
    async checkManualWarranty() {
        const textarea = document.getElementById('serialTextarea');
        const text = textarea.value.trim();
        
        if (!text) {
            this.showToast('Please enter serial numbers', 'warning');
            return;
        }

        // Parse serial numbers
        const serialNumbers = this.parseSerialNumbers(text);
        
        if (serialNumbers.length === 0) {
            this.showToast('No valid serial numbers found', 'error');
            return;
        }

        if (serialNumbers.length > 50) {
            this.showToast('Maximum 50 serial numbers allowed per request', 'error');
            return;
        }

        await this.performWarrantyCheck(serialNumbers);
    }

    parseSerialNumbers(text) {
        return text
            .split(/[\n,;]+/)
            .map(serial => serial.trim().toUpperCase())
            .filter(serial => serial && /^[A-Z0-9]{6,15}$/i.test(serial))
            .filter((serial, index, arr) => arr.indexOf(serial) === index); // Remove duplicates
    }

    async performWarrantyCheck(serialNumbers) {
        this.showLoading(true);
        this.updateProgress(0, serialNumbers.length);

        try {
            const response = await fetch('/api/warranty/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ serialNumbers })
            });

            const result = await response.json();

            if (result.success) {
                this.currentResults = result.results;
                this.filteredResults = [...this.currentResults];
                this.showResults();
                this.updateStats();
                this.showToast(`Processed ${result.totalProcessed} devices in ${(result.processingTime / 1000).toFixed(1)}s`, 'success');
            } else {
                this.showToast(result.message || 'Failed to check warranty', 'error');
            }
        } catch (error) {
            console.error('Warranty check error:', error);
            this.showToast('Failed to check warranty. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        document.getElementById('loadingSection').classList.toggle('hidden', !show);
        document.getElementById('resultsSection').classList.toggle('hidden', show);
        
        // Hide input section when loading
        document.querySelector('.input-section').style.display = show ? 'none' : 'block';
    }

    updateProgress(current, total) {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        document.getElementById('checkProgress').style.width = `${percentage}%`;
        document.getElementById('progressDetails').textContent = `${current}/${total} processed`;
    }

    showResults() {
        this.updateSummaryCards();
        this.applyFilters();
        this.showLoading(false);
    }

    updateSummaryCards() {
        const active = this.currentResults.filter(r => r.warrantyStatus === 'Active').length;
        const expiring = this.currentResults.filter(r => r.warrantyStatus === 'Expiring Soon').length;
        const expired = this.currentResults.filter(r => r.warrantyStatus === 'Expired').length;
        const errors = this.currentResults.filter(r => r.warrantyStatus === 'Error' || r.warrantyStatus === 'Not Found').length;

        document.getElementById('activeCount').textContent = active;
        document.getElementById('expiringCount').textContent = expiring;
        document.getElementById('expiredCount').textContent = expired;
        document.getElementById('errorCount').textContent = errors;
        document.getElementById('resultsCount').textContent = `${this.currentResults.length} devices processed`;
    }

    applyFilters() {
        const statusFilter = document.getElementById('statusFilter').value;
        const searchFilter = document.getElementById('searchFilter').value.toLowerCase();

        this.filteredResults = this.currentResults.filter(result => {
            const matchesStatus = statusFilter === 'all' || result.warrantyStatus === statusFilter;
            const matchesSearch = !searchFilter || 
                result.serialNumber.toLowerCase().includes(searchFilter) ||
                (result.productName && result.productName.toLowerCase().includes(searchFilter));
            
            return matchesStatus && matchesSearch;
        });

        this.currentPage = 1;
        this.renderTable();
        this.renderPagination();
    }

    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        this.filteredResults.sort((a, b) => {
            let aVal = a[column] || '';
            let bVal = b[column] || '';

            // Handle numeric values
            if (column === 'daysRemaining') {
                aVal = typeof aVal === 'number' ? aVal : (aVal === 'Expired' ? -1 : 0);
                bVal = typeof bVal === 'number' ? bVal : (bVal === 'Expired' ? -1 : 0);
            }

            // Handle dates
            if (column === 'warrantyEndDate') {
                aVal = aVal ? new Date(aVal).getTime() : 0;
                bVal = bVal ? new Date(bVal).getTime() : 0;
            }

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        // Update sort arrows
        document.querySelectorAll('.sort-arrow').forEach(arrow => {
            arrow.textContent = '↕️';
        });
        
        const currentHeader = document.querySelector(`[data-sort="${column}"] .sort-arrow`);
        if (currentHeader) {
            currentHeader.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
        }

        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('resultsTableBody');
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageResults = this.filteredResults.slice(startIndex, endIndex);

        tbody.innerHTML = pageResults.map(result => `
            <tr>
                <td><code>${result.serialNumber}</code></td>
                <td>${result.productName || 'Unknown'}</td>
                <td>${result.warrantyEndDate || 'N/A'}</td>
                <td>${this.formatDaysRemaining(result.daysRemaining)}</td>
                <td><span class="status-badge status-${result.warrantyStatus.toLowerCase().replace(' ', '-')}">${result.warrantyStatus}</span></td>
                <td>
                    <button class="btn-secondary" onclick="app.showDetails('${result.serialNumber}')" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
                        Details
                    </button>
                </td>
            </tr>
        `).join('');
    }

    formatDaysRemaining(days) {
        if (typeof days !== 'number') return days || 'N/A';
        if (days < 0) return 'Expired';
        if (days === 0) return 'Expires today';
        if (days === 1) return '1 day';
        return `${days} days`;
    }

    renderPagination() {
        const totalPages = Math.ceil(this.filteredResults.length / this.itemsPerPage);
        
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage === totalPages;

        const pageNumbers = document.getElementById('pageNumbers');
        pageNumbers.innerHTML = '';

        const maxVisiblePages = 7;
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('div');
            pageBtn.className = `page-number ${i === this.currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => this.goToPage(i));
            pageNumbers.appendChild(pageBtn);
        }
    }

    changePage(delta) {
        const totalPages = Math.ceil(this.filteredResults.length / this.itemsPerPage);
        const newPage = this.currentPage + delta;
        
        if (newPage >= 1 && newPage <= totalPages) {
            this.goToPage(newPage);
        }
    }

    goToPage(page) {
        this.currentPage = page;
        this.renderTable();
        this.renderPagination();
    }

    showDetails(serialNumber) {
        const result = this.currentResults.find(r => r.serialNumber === serialNumber);
        if (!result) return;

        const modalBody = document.getElementById('modalBody');
        modalBody.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <label>Serial Number:</label>
                    <value><code>${result.serialNumber}</code></value>
                </div>
                <div class="detail-item">
                    <label>Product Name:</label>
                    <value>${result.productName || 'Unknown'}</value>
                </div>
                <div class="detail-item">
                    <label>Product Type:</label>
                    <value>${result.productType || 'Unknown'}</value>
                </div>
                <div class="detail-item">
                    <label>Warranty Start:</label>
                    <value>${result.warrantyStartDate || 'N/A'}</value>
                </div>
                <div class="detail-item">
                    <label>Warranty End:</label>
                    <value>${result.warrantyEndDate || 'N/A'}</value>
                </div>
                <div class="detail-item">
                    <label>Days Remaining:</label>
                    <value>${this.formatDaysRemaining(result.daysRemaining)}</value>
                </div>
                <div class="detail-item">
                    <label>Status:</label>
                    <value><span class="status-badge status-${result.warrantyStatus.toLowerCase().replace(' ', '-')}">${result.warrantyStatus}</span></value>
                </div>
                <div class="detail-item">
                    <label>Warranty Type:</label>
                    <value>${result.warrantyType || 'Standard'}</value>
                </div>
                ${result.errorMessage ? `
                <div class="detail-item">
                    <label>Error:</label>
                    <value style="color: var(--danger-color);">${result.errorMessage}</value>
                </div>
                ` : ''}
            </div>
        `;

        document.getElementById('detailModal').classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('detailModal').classList.add('hidden');
    }

    exportResults() {
        if (this.currentResults.length === 0) {
            this.showToast('No results to export', 'warning');
            return;
        }

        const headers = ['Serial Number', 'Product Name', 'Product Type', 'Warranty Start', 'Warranty End', 'Days Remaining', 'Status', 'Warranty Type'];
        const csvContent = [
            headers.join(','),
            ...this.currentResults.map(result => [
                result.serialNumber,
                result.productName || '',
                result.productType || '',
                result.warrantyStartDate || '',
                result.warrantyEndDate || '',
                result.daysRemaining || '',
                result.warrantyStatus,
                result.warrantyType || ''
            ].map(field => `"${field}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lenovo_warranty_results_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Results exported successfully', 'success');
    }

    clearManualInput() {
        document.getElementById('serialTextarea').value = '';
    }

    resetApp() {
        this.currentResults = [];
        this.filteredResults = [];
        this.currentPage = 1;
        
        document.getElementById('serialTextarea').value = '';
        document.getElementById('statusFilter').value = 'all';
        document.getElementById('searchFilter').value = '';
        
        this.showLoading(false);
        document.querySelector('.input-section').style.display = 'block';
        this.switchTab('upload');
        this.updateStats();
    }

    updateStats() {
        // This would typically fetch from an API
        // For now, update with current session data
        const total = this.currentResults.length;
        const active = this.currentResults.filter(r => r.warrantyStatus === 'Active').length;
        
        document.getElementById('totalProcessed').textContent = total;
        document.getElementById('activeWarranties').textContent = active;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span>${this.getToastIcon(type)}</span>
                <span>${message}</span>
            </div>
        `;

        document.getElementById('toastContainer').appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || icons.info;
    }
}

// Global functions for modal and other interactions
window.showAbout = function() {
    alert('Lenovo Warranty Lookup Tool v1.0\n\nThis tool helps you check warranty status for multiple Lenovo devices using their serial numbers.\n\nNote: This tool is not affiliated with Lenovo Group.');
};

window.showPrivacy = function() {
    alert('Privacy Policy\n\nThis tool processes serial numbers to check warranty status. No personal data is stored. All warranty information is retrieved directly from Lenovo\'s systems.');
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.app = new WarrantyLookupApp();
});

// Add CSS for detail grid
const style = document.createElement('style');
style.textContent = `
    .detail-grid {
        display: grid;
        gap: 1rem;
    }
    
    .detail-item {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: 1rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid var(--light-gray);
    }
    
    .detail-item:last-child {
        border-bottom: none;
    }
    
    .detail-item label {
        font-weight: 600;
        color: var(--dark-gray);
    }
    
    .detail-item value {
        color: var(--secondary-color);
    }
`;
document.head.appendChild(style);