/**
 * Space management operations for the OneDrive Analyzer
 */

// Export space management related functions
window.oneDriveSpaceOperations = {
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
                    window.oneDriveUtils.showToast(appData, `Successfully made "${file.name}" cloud-only`, 'success');
                    
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
                        window.oneDriveUtils.showToast(appData, `Successfully made ${successCount} files cloud-only`, 'success');
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