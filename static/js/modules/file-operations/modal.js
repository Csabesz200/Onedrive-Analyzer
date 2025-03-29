/**
 * Modal-related operations for the OneDrive Analyzer
 */

// Export modal related functions
window.oneDriveModalOperations = {
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
        
        // Set modal toggle for DaisyUI
        if (document.getElementById('confirmation-modal')) {
            document.getElementById('confirmation-modal').checked = true;
        }
    },

    /**
     * Handle modal confirmation action
     * @param {Object} appData - The app data context
     */
    confirmAction: async function(appData) {
        appData.modalOpen = false;
        
        // Set modal toggle for DaisyUI
        if (document.getElementById('confirmation-modal')) {
            document.getElementById('confirmation-modal').checked = false;
        }
        
        if (appData.modalAction === 'freeSpace') {
            await window.oneDriveSpaceOperations.doFreeUpSpace(appData, appData.modalData);
        } else if (appData.modalAction === 'freeMultiple') {
            await window.oneDriveSpaceOperations.doFreeMultipleFiles(appData, appData.modalData);
        }
        
        // Reset modal data
        appData.modalAction = null;
        appData.modalData = null;
    }
};