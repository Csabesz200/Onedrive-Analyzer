/**
 * File scanning operations for the OneDrive Analyzer
 */

// Export scan related functions
window.oneDriveScanOperations = {
    /**
     * Scan OneDrive files
     * @param {Object} appData - The app data context
     * @param {number} page - Page number to load
     */
    scanFiles: async function(appData, page = 1) {
        // Progress interval reference for cleanup
        let progressInterval = null;
        
        try {
            // Check if path is configured
            if (!appData.isPathConfigured) {
                window.oneDriveUtils.showToast(appData, 'Please configure the OneDrive path first', 'error');
                window.oneDrivePath.openPathConfig(appData);
                return;
            }
            
            // Initialize safe default pagination object immediately
            // This prevents errors if templates try to access pagination before it's loaded
            if (!appData.pagination) {
                appData.pagination = {
                    page: page || 1,
                    per_page: appData.itemsPerPage || 50,
                    total_files: 0,
                    total_pages: 1,
                    has_next: false,
                    has_previous: false
                };
            }
            
            // If a page is provided, preserve the current scan state
            // and only update the page-related data
            const isPageChange = page > 1 && appData.scanned;
            
            // Update the pagination page - important for navigation
            appData.pagination.page = page;
            
            // Only show full loading state for initial scans, not page changes
            if (!isPageChange) {
                appData.isLoading = true;
                appData.scanned = false;
                appData.scanStatus = 'Initializing scan...';
                appData.scanProgress = 0;
                appData.showScanningIndicator = true;
            } else {
                // For page changes, just show a lighter loading indicator
                appData.isLoading = true;
                appData.showScanningIndicator = false;
            }
            
            // Set up polling for scan progress
            progressInterval = setInterval(async () => {
                try {
                    const statusResponse = await fetch('/api/scan-status');
                    const statusData = await statusResponse.json();
                    
                    appData.scanStatus = statusData.status;
                    appData.scanProgress = statusData.progress;
                    
                    // Update the scan message based on the current stage
                    if (statusData.current_directory) {
                        appData.scanMessage = statusData.current_directory;
                    }
                    
                    if (statusData.files_processed) {
                        appData.scanProgress = Math.min(99, statusData.files_processed / (statusData.total_estimate || 100) * 100);
                    }
                } catch (error) {
                    console.error('Error fetching scan status:', error);
                }
            }, 500);
            
            // Prepare API call parameters
            const params = new URLSearchParams({
                page: page,
                per_page: appData.itemsPerPage || 50,
                max_depth: appData.maxDepth || 2,
                use_threads: appData.useThreads !== undefined ? appData.useThreads : true,
                max_workers: appData.maxWorkers || 4
            });
            
            // Include threading parameters in the API call
            const response = await fetch(`/api/scan?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            const data = await response.json();
            
            // Validate data structure
            if (!data || !data.files || !Array.isArray(data.files)) {
                console.error('Invalid file data from server:', data);
                throw new Error('Invalid file data from server');
            }
            
            // Log to better understand pagination issues
            console.group('File scanning data');
            console.log(`Files returned: ${data.files.length}`);
            console.log(`Total files in stats: ${data.stats ? data.stats.total_files : 0}`);
            console.log('Pagination info:', data.pagination);
            console.groupEnd();
            
            // Initialize files with isProcessing flag and relative path
            appData.files = data.files.map(file => {
                // Get the actual relative folder path (without the filename)
                const fullPath = file.path;
                const fileName = file.name;
                
                // Get the relative path using the utility function
                let relativePath = '';
                if (window.oneDriveUtils && window.oneDriveUtils.getRelativePath) {
                    relativePath = window.oneDriveUtils.getRelativePath(fullPath, appData.onedrivePath);
                    console.log(`File: ${fileName}, Relative folder path: ${relativePath}`);
                } else {
                    // Fallback to simpler calculation
                    const pathParts = fullPath.split(/[\\|\/]/);
                    if (pathParts.length > 2) {
                        relativePath = pathParts[pathParts.length - 2];
                    }
                }
                
                return {
                    ...file,
                    isProcessing: false,
                    relativePath: relativePath
                };
            });
            
            // Make sure we have pagination data
            if (data.pagination) {
                appData.pagination = data.pagination;
            } else {
                // If the server didn't return pagination, create a default
                appData.pagination = {
                    page: page,
                    per_page: appData.itemsPerPage || 50,
                    total_files: data.files.length,
                    total_pages: 1,
                    has_next: false,
                    has_previous: page > 1
                };
                console.warn('Server did not return pagination data, using default');
            }
            
            appData.stats = data.stats;
            appData.scanned = true;
            
            // Debug path information
            if (window.oneDriveUtils && window.oneDriveUtils.debugPaths) {
                window.oneDriveUtils.debugPaths(appData);
            }
            
            if (appData.files.length === 0) {
                window.oneDriveUtils.showToast(appData, 'No files found in the specified directory', 'error');
            } else {
                // Handle notifications differently for initial scans vs page changes
                if (isPageChange) {
                    // For page changes, just show a simple notification
                    window.oneDriveUtils.showToast(appData, `Viewing page ${appData.pagination.page} of ${appData.pagination.total_pages}`);
                } else {
                    // For initial scans, show more detailed information
                    if (appData.stats.local_files > 0) {
                        window.oneDriveUtils.showToast(appData, `Scanned ${appData.stats.total_files} files. Found ${appData.stats.local_files} local files that can be freed.`);
                        // Auto-filter to local files to help users focus on them
                        appData.filterStatus = 'local';
                    } else {
                        window.oneDriveUtils.showToast(appData, `Scanned ${appData.stats.total_files} files successfully. All files are already cloud-only.`);
                    }
                }
            }
        } catch (error) {
            console.error('Error scanning files:', error);
            window.oneDriveUtils.showToast(appData, 'Error scanning files: ' + error.message, 'error');
            
            // Make sure we're not in a loading state
            appData.isLoading = false;
            appData.showScanningIndicator = false;
            
            // Ensure pagination is initialized even on error
            if (!appData.pagination) {
                appData.pagination = {
                    page: page || 1,
                    per_page: appData.itemsPerPage || 50,
                    total_files: 0,
                    total_pages: 1,
                    has_next: false,
                    has_previous: false
                };
            }
        } finally {
            if (progressInterval) {
                clearInterval(progressInterval);
            }
            appData.isLoading = false;
            appData.showScanningIndicator = false;
        }
    },

    /**
     * Update items per page setting
     * @param {Object} appData - The app data context
     * @param {number} perPage - Number of items per page
     */
    updateItemsPerPage: function(appData, perPage) {
        // Store the preference
        appData.itemsPerPage = parseInt(perPage) || 50;
        
        // Update the pagination per_page if it exists
        if (appData.pagination) {
            appData.pagination.per_page = appData.itemsPerPage;
        }
        
        // Reload the current page with new per_page setting
        this.scanFiles(appData, 1);
    }
};