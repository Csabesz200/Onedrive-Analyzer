/**
 * File operations for the OneDrive Analyzer
 */

// Making file operation functions available globally
window.oneDriveOperations = {
    /**
     * Scan OneDrive files
     * @param {Object} appData - The app data context
     */
    scanFiles: async function(appData) {
        // Check if path is configured
        if (!appData.isPathConfigured) {
            window.oneDriveUtils.showToast(appData, 'Please configure the OneDrive path first', 'error');
            window.oneDrivePath.openPathConfig(appData);
            return;
        }
        
        appData.isLoading = true;
        appData.scanned = false;
        appData.scanStatus = 'Initializing scan...';
        appData.scanProgress = 0;
        appData.showScanningIndicator = true;
        
        // Set up polling for scan progress
        const progressInterval = setInterval(async () => {
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
        
        try {
            // Include threading parameters in the API call
            const response = await fetch(`/api/scan?max_depth=${appData.maxDepth}&use_threads=${appData.useThreads}&max_workers=${appData.maxWorkers}`);
            const data = await response.json();
            
            // Initialize files with isProcessing flag set to false
            appData.files = data.files.map(file => ({
                ...file,
                isProcessing: false
            }));
            appData.stats = data.stats;
            appData.scanned = true;
            
            if (appData.files.length === 0) {
                window.oneDriveUtils.showToast(appData, 'No files found in the specified directory', 'error');
            } else {
                // Notice about local files if any are found
                if (appData.stats.local_files > 0) {
                    window.oneDriveUtils.showToast(appData, `Scanned ${appData.files.length} files. Found ${appData.stats.local_files} local files that can be freed.`);
                    // Auto-filter to local files to help users focus on them
                    appData.filterStatus = 'local';
                } else {
                    window.oneDriveUtils.showToast(appData, `Scanned ${appData.files.length} files successfully. All files are already cloud-only.`);
                }
            }
        } catch (error) {
            console.error('Error scanning files:', error);
            window.oneDriveUtils.showToast(appData, 'Error scanning files: ' + error.message, 'error');
        } finally {
            clearInterval(progressInterval);
            appData.isLoading = false;
            appData.showScanningIndicator = false;
        }
    },

    /**
     * Make a file cloud-only to free up space
     * @param {Object} appData - The app data context
     * @param {Object} file - The file to make cloud-only
     */
    freeUpSpace: async function(appData, file) {
        console.log('freeUpSpace called for file:', file.name, 'isProcessing:', file.isProcessing);
        
        // Direct processing without modal confirmation
        if (file && !file.is_cloud_only && !file.isProcessing) {
            console.log('Directly processing file:', file.name);
            file.isProcessing = true; // Set this flag immediately
            await this.doFreeUpSpace(appData, file);
            return;
        }
        
        // Skip if already cloud-only or processing
        if (file.is_cloud_only || file.isProcessing) {
            console.log('File is either cloud-only or already processing:', file.name);
            return;
        }
    },

    /**
     * Show confirmation dialog for freeing multiple files
     * @param {Object} appData - The app data context
     * @param {Array} filesToFree - Optional specific files to free, defaults to all local files
     */
    confirmFreeMultipleFiles: function(appData, filesToFree) {
        // If no files specified, use all local files
        const localFiles = filesToFree || appData.files.filter(file => !file.is_cloud_only);
        
        if (localFiles.length === 0) {
            window.oneDriveUtils.showToast(appData, 'No local files to free up', 'error');
            return;
        }
        
        appData.modalMessage = `Are you sure you want to make all ${localFiles.length} local files cloud-only? This will free up ${window.oneDriveUtils.humanizeSize(localFiles.reduce((sum, file) => sum + file.size, 0))} of local storage.`;
        appData.modalAction = 'freeMultiple';
        appData.modalData = localFiles;
        appData.modalOpen = true;
    },

    /**
     * Handle modal confirmation action
     * @param {Object} appData - The app data context
     */
    confirmAction: async function(appData) {
        appData.modalOpen = false;
        
        if (appData.modalAction === 'freeSpace') {
            await this.doFreeUpSpace(appData, appData.modalData);
        } else if (appData.modalAction === 'freeMultiple') {
            await this.doFreeMultipleFiles(appData, appData.modalData);
        }
        
        // Reset modal data
        appData.modalAction = null;
        appData.modalData = null;
    },

    /**
     * Perform the actual space freeing operation for a single file
     * @param {Object} appData - The app data context
     * @param {Object} file - The file to make cloud-only
     */
    doFreeUpSpace: async function(appData, file) {
        console.log('doFreeUpSpace executing for:', file.name);
        // Ensure the file is marked as processing
        file.isProcessing = true;
        try {
            // Generate a unique processing ID for this file
            const processingId = `processing-${file.name}-${Date.now()}`;
            
            // Show an initial toast to inform the user the operation is in progress
            window.oneDriveUtils.showToast(appData, `Processing "${file.name}"...`, 'info', 60000, processingId);
            
            // Store the processing toast ID on the file object temporarily
            file.processingToastId = processingId;
            
            // Add a small delay to ensure the UI is updated before the request
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const response = await fetch('/api/free-space', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: file.path })
            });
            
            // Clear the processing toast
            appData.toasts = appData.toasts.filter(toast => toast.id !== processingId);
            delete file.processingToastId;
            
            // Always reset the processing status here too
            file.isProcessing = false;
            
            if (!response.ok) {
                window.oneDriveUtils.showToast(appData, `Network error (${response.status}): ${response.statusText}`, 'error');
                console.error('Network error:', response);
                return;
            }
            
            try {
                const result = await response.json();
                
                if (result.success) {
                    // Update only the cloud status of the file without changing its position
                    const index = appData.files.findIndex(f => f.path === file.path);
                    if (index !== -1) {
                        appData.files[index].is_cloud_only = true;
                        appData.files[index].isProcessing = false;
                        
                        // Update stats, but don't resort the files
                        appData.stats.local_files--;
                        appData.stats.remote_files++;
                        appData.stats.local_size -= file.size;
                        appData.stats.human_local_size = window.oneDriveUtils.humanizeSize(appData.stats.local_size);
                        appData.stats.potential_savings = appData.stats.human_local_size;
                    }
                    
                    // Show success message
                    window.oneDriveUtils.showToast(appData, `Successfully made "${file.name}" cloud-only`);
                    
                    // Force a rescan of the file to verify it's now cloud-only
                    setTimeout(() => {
                        // Check if the file is now cloud-only using the API
                        fetch('/api/free-space', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ path: file.path, verify_only: true })
                        })
                        .then(resp => resp.json())
                        .then(verifyResult => {
                            if (verifyResult.is_cloud_only) {
                                // Already updated the UI, just log success
                                console.log(`Verified: ${file.name} is now cloud-only`);
                            } else {
                                // If API says it's not cloud-only but UI shows it is, warn the user
                                if (appData.files.find(f => f.path === file.path)?.is_cloud_only) {
                                    window.oneDriveUtils.showToast(appData, `Warning: File status may not be accurate. Try rescanning.`, 'warning');
                                }
                            }
                        })
                        .catch(err => console.error('Error verifying file status:', err));
                    }, 2000);
                } else {
                    // Show detailed error message from the server
                    window.oneDriveUtils.showToast(appData, `Error: ${result.message}`, 'error');
                    console.error('Server reported error:', result.message);
                }
            } catch (parseError) {
                window.oneDriveUtils.showToast(appData, 'Error parsing server response', 'error');
                console.error('JSON parse error:', parseError);
            }
        } catch (error) {
            console.error('Error freeing up space:', error);
            window.oneDriveUtils.showToast(appData, 'Error freeing up space: ' + (error.message || 'Unknown error'), 'error');
            
            // Clear any processing toasts for this file
            if (file.processingToastId) {
                appData.toasts = appData.toasts.filter(toast => toast.id !== file.processingToastId);
                delete file.processingToastId;
            }
            
            // Always reset processing state on error
            file.isProcessing = false;
            console.log('Reset processing state for:', file.name);
        }
    },

    /**
     * Make multiple files cloud-only at once
     * @param {Object} appData - The app data context
     * @param {Array} files - The files to make cloud-only
     */
    doFreeMultipleFiles: async function(appData, files) {
        try {
            // Generate a unique ID for this batch operation
            const processingBatchId = `batch-process-${Date.now()}`;
            
            // Show processing toast
            window.oneDriveUtils.showToast(appData, `Processing multiple files (0/${files.length})...`, 'info', 120000, processingBatchId);
            
            // Mark files as being processed
            files.forEach(file => {
                file.processingToastId = processingBatchId;
            });
            
            const paths = files.map(file => file.path);
            
            const response = await fetch('/api/free-multiple', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ paths })
            });
            
            // Clear the processing toast and processing flags
            appData.toasts = appData.toasts.filter(toast => toast.id !== processingBatchId);
            files.forEach(file => {
                delete file.processingToastId;
            });
            
            if (!response.ok) {
                window.oneDriveUtils.showToast(appData, `Network error (${response.status}): ${response.statusText}`, 'error');
                console.error('Network error:', response);
                return;
            }
            
            try {
                const result = await response.json();
                
                if (result.success) {
                    // Count successful operations
                    const successCount = result.results.filter(r => r.success).length;
                    const failedCount = result.results.length - successCount;
                    
                    // Update file statuses in the UI without reordering
                    result.results.forEach(fileResult => {
                        if (fileResult.success) {
                            const index = appData.files.findIndex(f => f.path === fileResult.path);
                            if (index !== -1) {
                                appData.files[index].is_cloud_only = true;
                                appData.files[index].isProcessing = false;
                            }
                        }
                    });
                    
                    // Update stats
                    window.oneDriveUtils.recalculateStats(appData);
                    
                    // Show success message with details
                    if (failedCount > 0) {
                        window.oneDriveUtils.showToast(appData, `Made ${successCount} files cloud-only, ${failedCount} failed`, 'warning');
                    } else {
                        window.oneDriveUtils.showToast(appData, `Successfully made ${successCount} files cloud-only`);
                    }
                } else {
                    window.oneDriveUtils.showToast(appData, 'Operation failed. See console for details.', 'error');
                    console.error('Free multiple files operation failed:', result);
                }
            } catch (parseError) {
                window.oneDriveUtils.showToast(appData, 'Error parsing server response', 'error');
                console.error('JSON parse error:', parseError);
            }
        } catch (error) {
            console.error('Error freeing up multiple files:', error);
            window.oneDriveUtils.showToast(appData, 'Error freeing up files: ' + (error.message || 'Unknown error'), 'error');
            
            // Clear any remaining processing flags
            files.forEach(file => {
                delete file.processingToastId;
            });
        }
    }
};