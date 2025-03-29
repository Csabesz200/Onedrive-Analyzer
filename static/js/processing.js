/**
 * Processing functions for OneDrive Analyzer
 */
function updateProcessingFunctions(appData) {
    if (!window.oneDriveOperations) {
        window.oneDriveOperations = {};
    }

    let scanStatusInterval = null;

    //**  Use context param for the inner functions, it will be called INSIDE Alpine JS instance ***//
    const createUpdateScanStatus = (context) => {
        return async () => {
            try {
                const response = await fetch('/api/scan-status');
                const status = await response.json();

                if (status.status) {
                    const timeDisplay = (status.time_elapsed > 5) ?
                        `${Math.floor(status.time_elapsed / 60)}m ${status.time_elapsed % 60}s` :
                        `${status.time_elapsed}s`;
                    context.scanStatus = `${status.status} (${timeDisplay})`;
                } else {
                    context.scanStatus = 'Scanning...';
                }

                // Force a number between 0 and 100, even if the API returns weird data
                context.scanProgress = Math.max(0, Math.min(100, (status.progress != null) ? Math.round(status.progress) : 0));

                if (status.current_directory) {
                    if (status.status && status.status.startsWith('Processing file')) {
                        const fileName = status.current_directory.split(/[/\\]/).pop();
                        context.scanMessage = `Processing: ${fileName}`;
                    } else {
                        context.scanMessage = status.current_directory;
                    }
                } else {
                    context.scanMessage = 'Initializing...'; // Ensure we always have a default value
                }

                if (status.total_estimate && status.files_processed >= 0) {
                    const progress = Math.min(100, (status.files_processed / status.total_estimate) * 100);
                    context.scanProgress = Math.max(0, Math.min(100, Math.round(progress))); // Avoid invalid percentages
                }

                if (status.status === 'Scan complete' || status.status === 'Idle') {
                    clearInterval(scanStatusInterval);
                }

                // Add this console log for debugging
                console.log('Scan Status Update:', { scanMessage: context.scanMessage, scanProgress: context.scanProgress });

            } catch (error) {
                console.error('Failed to fetch scan status:', error);
                clearInterval(scanStatusInterval);
                context.scanMessage = 'Error fetching scan status'; // Report error to the UI
            }
        };
    };

    window.oneDriveOperations.updateItemsPerPage = function(context, perPage) {
        context.itemsPerPage = parseInt(perPage) || 50;
        window.oneDriveOperations.scanFiles(context, 1, false);
    };

    window.oneDriveOperations.scanFiles = async function(context, page = 1, forceRescan = false) {
        console.log(`Scanning files, page: ${page}, force rescan: ${forceRescan}`);

        context.isLoading = true;
        context.scanned = false;
        context.showScanningIndicator = true;
        context.files = [];
        context.scanStatus = 'Initializing scan...';
        context.scanMessage = 'Initializing...'; // Initialize HERE as well
        context.scanProgress = 0;

        clearInterval(scanStatusInterval);
        const updateScanStatus = createUpdateScanStatus(context);
        scanStatusInterval = setInterval(updateScanStatus, 1000);

        try {
            const params = new URLSearchParams({
                page,
                per_page: context.itemsPerPage,
                max_depth: context.maxDepth,
                use_threads: context.useThreads,
                max_workers: context.maxWorkers,
                force_rescan: forceRescan,
            });

            //Add the sort params to the URL
            [context.sortColumn, context.sortDirection].forEach((val, index) => {
                if (val) params.append(['sort_by', 'sort_order'][index], val)
            });
            //Add the cloud filtering if present
            ['local', 'cloud'].forEach(filter => {
                if (context.filterStatus == filter) params.append('is_cloud_only', filter == 'cloud')
            });
            //Add search query to URL
            if (context.searchQuery) params.append('search_query', context.searchQuery);

            const response = await fetch(`/api/scan?${params}`);
            if (!response.ok) throw new Error(`API request failed with status: ${response.status}`);

            const data = await response.json();

            clearInterval(scanStatusInterval);

            context.files = data.files || [];
            context.stats = data.stats || {};
            context.scanned = true;
            context.isLoading = false;
            context.showScanningIndicator = false;
            context.scanStatus = 'Scan complete';
            context.scanMessage = '';
            context.scanProgress = 100;

            const toastMessage = data.cache_used ?
                `Loaded ${data.stats.total_files} files from cache. Last scan: ${new Date(data.last_scan_time).toLocaleString()}` :
                `Scanned ${data.stats.total_files} files. Total size: ${data.stats.human_total_size}`;

            context.showToast(toastMessage, data.cache_used ? 'info' : 'success');

        } catch (error) {
            console.error('Scan failed:', error);
            clearInterval(scanStatusInterval);
            context.isLoading = false;
            context.showScanningIndicator = false;
            context.scanStatus = 'Scan failed';
            context.scanMessage = 'Scan Failed';
            context.showToast('Failed to scan files. Please try again.', 'error');
        }
    };

    window.oneDriveOperations.forceRescan = function(context) {
        window.oneDriveOperations.scanFiles(context, 1, true);
    };

    return appData;
}

window.updateProcessingFunctions = updateProcessingFunctions;