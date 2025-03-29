/**
 * OneDrive Analyzer - Main Application
 * A tool to analyze and manage your OneDrive storage
 */

// Use global modules instead of ES6 imports
// These are defined in the respective JavaScript files that are included in the HTML

/**
 * Main application function
 * Initializes the application state and methods
 */
function app() {
    // Initialize app data with default values
    const appData = {
        // Files and status data
        files: [], 
        pagination: {
            page: 1,
            per_page: 50,
            total_files: 0,
            total_pages: 1,
            has_next: false,
            has_previous: false
        },
        stats: {
            total_files: 0,
            local_files: 0,
            remote_files: 0,
            total_size: 0,
            human_total_size: '0 B',
            local_size: 0,
            human_local_size: '0 B',
            potential_savings: '0 B'
        },
        
        // Path management
        onedrivePath: '',
        isPathConfigured: false,
        showPathConfig: false,
        newOnedrivePath: '',
        configError: '',
        
        // Scan status
        isLoading: false,
        scanned: false,
        scanStatus: '',
        scanProgress: 0,
        scanMessage: '',
        showScanningIndicator: false,
        
        // File filtering and display options
        searchQuery: '',
        filterStatus: 'all',
        sortColumn: 'size',
        sortDirection: 'desc',
        viewMode: 'cards',
        groupByFolder: false,
        prioritizeLocalFiles: true,
        itemsPerPage: 50,  // Default items per page
        
        // Scan options
        maxDepth: 2,
        useThreads: true,
        maxWorkers: 4,
        
        // UI elements
        toasts: [],
        modalOpen: false,
        modalMessage: '',
        modalAction: null,
        modalData: null,
        
        // Expose utility functions directly
        humanizeSize: window.oneDriveUtils ? window.oneDriveUtils.humanizeSize : function(size) { return size + ' B'; },
        
        // Computed properties
        get filteredFiles() {
            return window.oneDriveFiltering ? window.oneDriveFiltering.getFilteredFiles(this.files, {
                filterStatus: this.filterStatus,
                searchQuery: this.searchQuery,
                sortColumn: this.sortColumn,
                sortDirection: this.sortDirection,
                prioritizeLocalFiles: this.prioritizeLocalFiles,
                groupByFolder: this.groupByFolder
            }) : this.files;
        },
        
        get groupedFiles() {
            if (!this.groupByFolder) return this.filteredFiles;
            return window.oneDriveFiltering ? window.oneDriveFiltering.groupFilesByFolder(this.filteredFiles) : this.filteredFiles;
        },
        
        // Initialize the application
        async init() {
            console.log('OneDrive Analyzer initialized');
            
            // Get the OneDrive path from the server
            if (window.oneDrivePath && window.oneDrivePath.getOnedrivePath) {
                await window.oneDrivePath.getOnedrivePath(this);
            } else {
                console.error('Path management module not loaded correctly!');
            }
            
            // Check if folder browser is supported
            if (window.oneDrivePath && window.oneDrivePath.checkFolderBrowserSupport) {
                window.oneDrivePath.checkFolderBrowserSupport();
            }
        },
        
        // Methods - using global module functions with bound app context
        
        // Path management
        getOnedrivePath() { 
            return window.oneDrivePath ? window.oneDrivePath.getOnedrivePath(this) : null; 
        },
        updateOnedrivePath() { 
            return window.oneDrivePath ? window.oneDrivePath.updateOnedrivePath(this) : null; 
        },
        openPathConfig() { 
            return window.oneDrivePath ? window.oneDrivePath.openPathConfig(this) : null; 
        },
        closePathConfig() { 
            return window.oneDrivePath ? window.oneDrivePath.closePathConfig(this) : null; 
        },
        openFolderBrowser() {
            return window.oneDrivePath ? window.oneDrivePath.openFolderBrowser() : null;
        },
        handleFolderSelection(event) { 
            return window.oneDrivePath ? window.oneDrivePath.handleFolderSelection(this, event) : null; 
        },
        
        // File operations
        scanFiles(page) { 
            return window.oneDriveOperations ? window.oneDriveOperations.scanFiles(this, page) : null; 
        },
        freeUpSpace(file) { 
            return window.oneDriveOperations ? window.oneDriveOperations.freeUpSpace(this, file) : null; 
        },
        confirmFreeMultipleFiles(files) { 
            return window.oneDriveOperations ? window.oneDriveOperations.confirmFreeMultipleFiles(this, files) : null; 
        },
        confirmAction() { 
            return window.oneDriveOperations ? window.oneDriveOperations.confirmAction(this) : null; 
        },
        doFreeUpSpace(file) { 
            return window.oneDriveOperations ? window.oneDriveOperations.doFreeUpSpace(this, file) : null; 
        },
        doFreeMultipleFiles(files) { 
            return window.oneDriveOperations ? window.oneDriveOperations.doFreeMultipleFiles(this, files) : null; 
        },
        
        // Filtering and sorting
        sortBy(column) { 
            return window.oneDriveFiltering ? window.oneDriveFiltering.sortBy(this, column) : null; 
        },
        updateSort(value) {
            return window.oneDriveFiltering ? window.oneDriveFiltering.updateSort(this, value) : null;
        },
        updateFilter(field, value) {
            // Simple implementation to handle filter changes
            if (field === 'is_cloud_only') {
                this.filterStatus = value === 'true' ? 'cloud' : (value === 'false' ? 'local' : 'all');
            }
        },
        
        // Items per page updater
        updateItemsPerPage(perPage) {
            return window.oneDriveOperations ? window.oneDriveOperations.updateItemsPerPage(this, perPage) : null;
        },
        
        // UI utilities
        copyPathToClipboard(path) { 
            return window.oneDriveUtils ? window.oneDriveUtils.copyPathToClipboard(this, path) : null; 
        },
        showToast(message, type, duration, customId) { 
            return window.oneDriveUtils ? window.oneDriveUtils.showToast(this, message, type, duration, customId) : null;
        },
        recalculateStats() { 
            return window.oneDriveUtils ? window.oneDriveUtils.recalculateStats(this) : null; 
        },
        
        // Pagination utilities
        calculatePageRange() {
            const pagination = this.pagination;
            if (!pagination || !pagination.page || !pagination.total_pages) return [];

            const currentPage = pagination.page;
            const totalPages = pagination.total_pages;
            const range = [];

            // Always show first and last page
            const startPage = Math.max(1, currentPage - 2);
            const endPage = Math.min(totalPages, currentPage + 2);

            for (let i = startPage; i <= endPage; i++) {
                range.push(i);
            }

            return range;
        },
        
        // Theme toggle
        toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            
            // Update HTML attribute
            document.documentElement.setAttribute('data-theme', newTheme);
            
            // Update class for Tailwind dark mode
            if (newTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
            
            // Save preference
            localStorage.setItem('theme', newTheme);
        }
    };
    
    // Apply any processing functions if they exist
    if (typeof updateProcessingFunctions === 'function') {
        return updateProcessingFunctions(appData);
    }
    
    return appData;
}

// Make the app available globally
window.app = app;