/**
 * Processing functions for OneDrive Analyzer
 * Handles async operations, scanning, and data manipulation
 */
function updateProcessingFunctions(appData) {
    // Modify the method in the oneDriveOperations global object
    if (!window.oneDriveOperations) {
        window.oneDriveOperations = {};
    }

    // Scan status polling
    let scanStatusInterval = null;

    // Function to fetch and update scan status
    const updateScanStatus = async () => {
        try {
            const response = await fetch('/api/scan-status');
            const status = await response.json();

            // Update scan status
            appData.scanStatus = status.status || 'Scanning...';
            appData.scanProgress = status.progress || 0;
            
            // Detailed current directory tracking
            if (status.current_directory) {
                // Shorten path for display
                const shortenPath = (path) => {
                    const parts = path.split(/[/\\]/);
                    return parts.length > 3 
                        ? `.../${parts[parts.length-3]}/${parts[parts.length-2]}/${parts[parts.length-1]}`
                        : path;
                };
                appData.scanMessage = `Processing: ${shortenPath(status.current_directory)}`;
            }

            // Stop interval if scan is complete
            if (status.status === 'Scan complete' || status.status === 'Idle') {
                if (scanStatusInterval) {
                    clearInterval(scanStatusInterval);
                    scanStatusInterval = null;
                }
            }
        } catch (error) {
            console.error('Failed to fetch scan status:', error);
            if (scanStatusInterval) {
                clearInterval(scanStatusInterval);
                scanStatusInterval = null;
            }
        }
    };

    // Scan files method with pagination support
    // New function to update items per page
    window.oneDriveOperations.updateItemsPerPage = function(context, perPage) {
        // Store the preference
        context.itemsPerPage = parseInt(perPage) || 50;
        // Reload the current page with new per_page setting
        window.oneDriveOperations.scanFiles(context, 1);
    };

    window.oneDriveOperations.scanFiles = async function(context, page = 1) {
        // Reset previous scan data
        context.isLoading = true;
        context.scanned = false;
        context.showScanningIndicator = true;
        context.files = [];
        context.scanStatus = 'Initializing scan...';
        context.scanMessage = '';
        context.scanProgress = 0;

        // Start periodic status updates
        if (scanStatusInterval) {
            clearInterval(scanStatusInterval);
        }
        scanStatusInterval = setInterval(updateScanStatus, 1000);

        try {
            // Prepare scan options
            const params = new URLSearchParams({
                page: page,
                per_page: context.itemsPerPage || 50,
                max_depth: context.maxDepth || 2,
                use_threads: context.useThreads !== undefined ? context.useThreads : true,
                max_workers: context.maxWorkers || 4
            });

            // Make API request
            const response = await fetch(`/api/scan?${params.toString()}`);
            const data = await response.json();

            // Stop status interval
            if (scanStatusInterval) {
                clearInterval(scanStatusInterval);
                scanStatusInterval = null;
            }

            // Update data
            context.files = data.files;
            context.stats = data.stats;
            context.scanned = true;
            context.isLoading = false;
            context.showScanningIndicator = false;
            context.scanStatus = 'Scan complete';
            context.scanMessage = '';
            context.scanProgress = 100;

            // Pagination details
            context.pagination = data.pagination;

            // Show results toast
            context.showToast(
                `Scanned ${data.stats.total_files} files. Total size: ${data.stats.human_total_size}`, 
                'success'
            );

            return data;
        } catch (error) {
            console.error('Scan failed:', error);
            
            // Stop status interval
            if (scanStatusInterval) {
                clearInterval(scanStatusInterval);
                scanStatusInterval = null;
            }

            // Reset loading states
            context.isLoading = false;
            context.showScanningIndicator = false;
            context.scanStatus = 'Scan failed';
            context.scanMessage = '';

            // Show error toast
            context.showToast('Failed to scan files. Please try again.', 'error');
            return null;
        }
    };

    return appData;
}

// Make the function available globally
window.updateProcessingFunctions = updateProcessingFunctions;