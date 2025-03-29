/**
 * OneDrive Analyzer - Main Application
 * A tool to analyze and manage your OneDrive storage
 */

function app() {
    const appData = {
        files: [],
        pagination: { page: 1, per_page: 50, total_files: 0, total_pages: 1, has_next: false, has_previous: false },
        stats: { total_files: 0, local_files: 0, remote_files: 0, total_size: 0, human_total_size: '0 B', local_size: 0, human_local_size: '0 B', potential_savings: '0 B' },
        onedrivePath: '',
        isPathConfigured: false,
        showPathConfig: false,
        newOnedrivePath: '',
        configError: '',
        isLoading: false,
        scanned: false,
        scanStatus: '',
        scanProgress: 0,
        scanMessage: '',
        showScanningIndicator: false,
        searchQuery: '',
        filterStatus: 'all',
        sortColumn: 'size',
        sortDirection: 'desc',
        viewMode: 'table',
        groupByFolder: false,
        prioritizeLocalFiles: true,
        itemsPerPage: 50,
        maxDepth: 2,
        useThreads: true,
        maxWorkers: 4,
        toasts: [],
        modalOpen: false,
        modalMessage: '',
        modalAction: null,
        modalData: null,

        humanizeSize: window.oneDriveUtils ? window.oneDriveUtils.humanizeSize : function(size) { return size + ' B'; },
        getFileTypeIcon: function(filename) { return window.oneDriveUtils ? window.oneDriveUtils.getFileTypeIcon(filename) : ''; },

        get filteredFiles() {
            return window.oneDriveFiltering ? window.oneDriveFiltering.getFilteredFiles(this.files, { filterStatus: this.filterStatus, searchQuery: this.searchQuery, sortColumn: this.sortColumn, sortDirection: this.sortDirection, prioritizeLocalFiles: this.prioritizeLocalFiles, groupByFolder: this.groupByFolder }) : this.files;
        },
        get groupedFiles() { return this.groupByFolder ? window.oneDriveFiltering.groupFilesByFolder(this.filteredFiles) : this.filteredFiles; },

        async init() {
            console.log('OneDrive Analyzer initialized');
            if (window.oneDrivePath && window.oneDrivePath.getOnedrivePath) await window.oneDrivePath.getOnedrivePath(this); else console.error('Path management module not loaded correctly!');
            if (window.oneDrivePath && window.oneDrivePath.checkFolderBrowserSupport) window.oneDrivePath.checkFolderBrowserSupport();
        },

        getOnedrivePath() { return window.oneDrivePath ? window.oneDrivePath.getOnedrivePath(this) : null; },
        updateOnedrivePath() { return window.oneDrivePath ? window.oneDrivePath.updateOnedrivePath(this) : null; },
        openPathConfig() { return window.oneDrivePath ? window.oneDrivePath.openPathConfig(this) : null; },
        closePathConfig() { return window.oneDrivePath ? window.oneDrivePath.closePathConfig(this) : null; },
        openFolderBrowser() { return window.oneDrivePath ? window.oneDrivePath.openFolderBrowser() : null; },
        handleFolderSelection(event) { return window.oneDrivePath ? window.oneDrivePath.handleFolderSelection(this, event) : null; },

        scanFiles(page, forceRescan = false) { return window.oneDriveOperations ? window.oneDriveOperations.scanFiles(this, page, forceRescan) : null; },
        forceRescan() { return window.oneDriveOperations ? window.oneDriveOperations.forceRescan(this) : null; },
        freeUpSpace(file) { return window.oneDriveOperations ? window.oneDriveOperations.freeUpSpace(this, file) : null; },
        confirmFreeMultipleFiles(files) { return window.oneDriveOperations ? window.oneDriveOperations.confirmFreeMultipleFiles(this, files) : null; },
        confirmAction() { return window.oneDriveOperations ? window.oneDriveOperations.confirmAction(this) : null; },
        doFreeUpSpace(file) { return window.oneDriveOperations ? window.oneDriveOperations.doFreeUpSpace(this, file) : null; },
        doFreeMultipleFiles(files) { return window.oneDriveOperations ? window.oneDriveOperations.doFreeMultipleFiles(this, files) : null; },

        sortBy(column) { return window.oneDriveFiltering ? window.oneDriveFiltering.sortBy(this, column) : null; },
        updateSort(value) { return window.oneDriveFiltering ? window.oneDriveFiltering.updateSort(this, value) : null; },
        updateFilter(field, value) {
            if (field === 'is_cloud_only') {
                this.filterStatus = value === 'true' ? 'cloud' : (value === 'false' ? 'local' : 'all');
            }
        },

        updateItemsPerPage(perPage) { return window.oneDriveOperations ? window.oneDriveOperations.updateItemsPerPage(this, perPage) : null; },

        copyPathToClipboard(path) { return window.oneDriveUtils ? window.oneDriveUtils.copyPathToClipboard(this, path) : null; },
        showToast(message, type, duration, customId) { return window.oneDriveUtils ? window.oneDriveUtils.showToast(this, message, type, duration, customId) : null; },
        recalculateStats() { return window.oneDriveUtils ? window.oneDriveUtils.recalculateStats(this) : null; },

        calculatePageRange() {
            if (!this.pagination || !this.pagination.page || !this.pagination.total_pages) return [];
            const { page, total_pages } = this.pagination;
            const startPage = Math.max(1, page - 2);
            const endPage = Math.min(total_pages, page + 2);
            return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
        },

        toggleTheme() {
            const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            document.documentElement.classList.toggle('dark', newTheme === 'dark');
            localStorage.setItem('theme', newTheme);
        }
    };

    if (typeof updateProcessingFunctions === 'function') return updateProcessingFunctions(appData);
    return appData;
}

window.app = app;