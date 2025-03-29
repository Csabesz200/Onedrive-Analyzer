/**
 * Path management functionality for the OneDrive Analyzer
 */

// Making path management functions accessible globally
window.oneDrivePath = {
    /**
     * Get OneDrive path from server
     * @param {Object} appData - The app data context
     */
    getOnedrivePath: async function(appData) {
        try {
            const response = await fetch('/api/onedrive-path');
            const data = await response.json();
            
            appData.onedrivePath = data.path;
            appData.isPathConfigured = data.configured;
            
            // If not configured, show the config dialog
            if (!appData.isPathConfigured) {
                appData.showPathConfig = true;
            }
            
            return data.path;
        } catch (error) {
            console.error('Error getting OneDrive path:', error);
            window.oneDriveUtils.showToast(appData, 'Error getting OneDrive path: ' + error.message, 'error');
        }
    },

    /**
     * Update OneDrive path on server
     * @param {Object} appData - The app data context
     */
    updateOnedrivePath: async function(appData) {
        // Validate path first
        if (!appData.newOnedrivePath.trim()) {
            appData.configError = 'Please enter a valid path';
            return;
        }
        
        try {
            const response = await fetch('/api/onedrive-path', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ path: appData.newOnedrivePath })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                appData.configError = errorData.message || 'Error updating path';
                return;
            }
            
            const data = await response.json();
            
            if (data.success) {
                appData.onedrivePath = data.path;
                appData.isPathConfigured = true;
                appData.showPathConfig = false;
                appData.configError = '';
                window.oneDriveUtils.showToast(appData, 'OneDrive path updated successfully', 'success');
            } else {
                appData.configError = data.message || 'Error updating path';
            }
        } catch (error) {
            console.error('Error updating OneDrive path:', error);
            appData.configError = error.message || 'Error updating path';
        }
    },

    /**
     * Open path configuration dialog
     * @param {Object} appData - The app data context
     */
    openPathConfig: function(appData) {
        appData.newOnedrivePath = appData.onedrivePath;
        appData.showPathConfig = true;
        if (document.getElementById('path-config-modal')) {
            document.getElementById('path-config-modal').checked = true;
        }
    },

    /**
     * Close path configuration dialog
     * @param {Object} appData - The app data context
     */
    closePathConfig: function(appData) {
        appData.showPathConfig = false;
        appData.configError = '';
        if (document.getElementById('path-config-modal')) {
            document.getElementById('path-config-modal').checked = false;
        }
    },

    /**
     * Check if folder browser API is supported by the browser
     */
    checkFolderBrowserSupport: function() {
        // Check if the browser supports the directory input
        const input = document.createElement('input');
        input.type = 'file';
        
        // If webkitdirectory or directory attributes are not supported
        if (!('webkitdirectory' in input) && !('directory' in input)) {
            // Hide the browse button if not supported
            const browseBtn = document.querySelector('[data-folder-browser]');
            if (browseBtn) {
                browseBtn.style.display = 'none';
            }
            console.log('Folder browser API is not supported in this browser');
            return false;
        } else {
            console.log('Folder browser API is supported');
            return true;
        }
    },

    /**
     * Open folder browser dialog for path selection
     */
    openFolderBrowser: function() {
        console.log('Opening folder browser');
        const fileInput = document.getElementById('folder-selector');
        
        if (fileInput) {
            // Clear the input first to allow selecting the same folder again
            fileInput.value = '';
            // Set accept attribute to prevent showing all files
            fileInput.setAttribute('accept', 'folder');
            fileInput.click();
        } else {
            console.error('Folder selector input not found');
            // Fallback to prompt if input not found
            const directoryPath = prompt('Enter the full path to your OneDrive folder:', 'C:\\Users\\YourName\\OneDrive');
            if (directoryPath) {
                const el = document.getElementById('onedrive-path').closest('[x-data]');
                if (el && el.__x) {
                    el.__x.$data.newOnedrivePath = directoryPath;
                }
            }
        }
    },

    /**
     * Handle folder selection from the browser
     * @param {Object} appData - The app data context
     * @param {Event} event - The file input change event
     */
    handleFolderSelection: function(appData, event) {
        console.log('Folder selection event triggered');
        const fileInput = event.target;
        
        // Cancel any actual file uploads
        event.preventDefault();
        event.stopPropagation();
        
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            try {
                // Extract folder name from the first file
                const file = fileInput.files[0];
                console.log('Selected first file:', file.name);
                
                if (file.webkitRelativePath) {
                    // Get the full relative path (e.g., "folder/subfolder/file.txt")
                    const relativePath = file.webkitRelativePath;
                    console.log('Relative path:', relativePath);
                    
                    // Extract just the folder name (first part of the path)
                    const folderName = relativePath.split('/')[0];
                    console.log('Selected folder name:', folderName);
                    
                    // Try to detect the username for a better path guess
                    const username = window.oneDriveUtils ? window.oneDriveUtils.detectUsername(appData.onedrivePath) : null;
                    
                    // Update the OneDrive path input field
                    let fullPath = '';
                    
                    // Check if it's a OneDrive folder
                    if (folderName.toLowerCase() === 'onedrive' || 
                        folderName.toLowerCase().startsWith('onedrive -')) {
                        // This looks like a OneDrive folder name
                        if (username) {
                            fullPath = `C:\\Users\\${username}\\${folderName}`;
                        } else {
                            fullPath = `C:\\Users\\[YourUsername]\\${folderName}`;
                        }
                    } else {
                        // It's some other folder
                        fullPath = folderName;
                        window.oneDriveUtils.showToast(appData, 
                            'Note: Selected folder does not appear to be a OneDrive folder. Please verify the path.', 
                            'warning');
                    }
                    
                    // Set the path in the input field
                    appData.newOnedrivePath = fullPath;
                    console.log('Set path to:', fullPath);
                } else {
                    // Some browsers don't provide webkitRelativePath
                    window.oneDriveUtils.showToast(appData, 
                        'Your browser doesn\'t provide folder path information. Please enter the path manually.', 
                        'warning');
                }
            } catch (error) {
                console.error('Error processing folder selection:', error);
                window.oneDriveUtils.showToast(appData, 
                    'Error processing folder selection: ' + error.message, 
                    'error');
            }
        }
        
        // Important: Clear the input to ensure no files are uploaded
        fileInput.value = '';
    }
};