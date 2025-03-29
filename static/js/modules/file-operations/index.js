/**
 * File operations for the OneDrive Analyzer
 * Main module that imports and re-exports all file operation functionality
 */

// Making file operation functions available globally
window.oneDriveOperations = {
    /**
     * Scan OneDrive files
     * @param {Object} appData - The app data context
     */
    scanFiles: function(appData, page) {
        return window.oneDriveScanOperations.scanFiles(appData, page);
    },

    /**
     * Update items per page setting
     * @param {Object} appData - The app data context
     * @param {number} perPage - Number of items per page
     */
    updateItemsPerPage: function(appData, perPage) {
        return window.oneDriveScanOperations.updateItemsPerPage(appData, perPage);
    },

    /**
     * Make a file cloud-only to free up space
     * @param {Object} appData - The app data context
     * @param {Object} file - The file to make cloud-only
     */
    freeUpSpace: function(appData, file) {
        return window.oneDriveSpaceOperations.freeUpSpace(appData, file);
    },

    /**
     * Perform the actual space freeing operation for a single file
     * @param {Object} appData - The app data context
     * @param {Object} file - The file to make cloud-only
     */
    doFreeUpSpace: function(appData, file) {
        return window.oneDriveSpaceOperations.doFreeUpSpace(appData, file);
    },

    /**
     * Make multiple files cloud-only at once
     * @param {Object} appData - The app data context
     * @param {Array} files - The files to make cloud-only
     */
    doFreeMultipleFiles: function(appData, files) {
        return window.oneDriveSpaceOperations.doFreeMultipleFiles(appData, files);
    },

    /**
     * Show confirmation dialog for freeing multiple files
     * @param {Object} appData - The app data context
     * @param {Array} filesToFree - Optional specific files to free, defaults to all local files
     */
    confirmFreeMultipleFiles: function(appData, filesToFree) {
        return window.oneDriveModalOperations.confirmFreeMultipleFiles(appData, filesToFree);
    },

    /**
     * Handle modal confirmation action
     * @param {Object} appData - The app data context
     */
    confirmAction: function(appData) {
        return window.oneDriveModalOperations.confirmAction(appData);
    }
};