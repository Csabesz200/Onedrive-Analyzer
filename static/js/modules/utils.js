/**
 * Utility functions for the OneDrive Analyzer application
 */

// Making the utility functions accessible globally
window.oneDriveUtils = {
    /**
     * Debug function to log path information
     * @param {Object} appData - The app data context
     */
    debugPaths: function(appData) {
        if (!appData || !appData.files || !appData.files.length) {
            console.warn('No files data available for debug');
            return;
        }
        
        console.group('Path debugging information');
        console.log('OneDrive base path:', appData.onedrivePath);
        
        // Sample first 3 files
        const sampleFiles = appData.files.slice(0, 3);
        sampleFiles.forEach((file, index) => {
            console.group(`File ${index + 1}`);
            console.log('Full path:', file.path);
            console.log('Parent folder:', file.parent_folder);
            console.log('Relative path:', file.relativePath);
            console.groupEnd();
        });
        
        console.groupEnd();
    },
    
    /**
     * Get the relative path after the OneDrive folder
     * @param {string} fullPath - Full file path
     * @param {string} onedrivePath - Base OneDrive path
     * @returns {string} - Relative path after OneDrive folder
     */
    getRelativePath: function(fullPath, onedrivePath) {
        if (!fullPath || !onedrivePath) return fullPath;
        
        try {
            // Normalize paths to handle case differences and standardize separators
            const normalizedFullPath = fullPath.toLowerCase().replace(/\\/g, '/');
            const normalizedBasePath = onedrivePath.toLowerCase().replace(/\\/g, '/');
            
            // Ensure the base path ends with a trailing slash for matching
            const basePathWithTrailingSlash = normalizedBasePath.endsWith('/') ? 
                normalizedBasePath : normalizedBasePath + '/';
                
            console.log('Normalized full path:', normalizedFullPath);
            console.log('Normalized base path:', basePathWithTrailingSlash);
            
            if (normalizedFullPath.startsWith(basePathWithTrailingSlash)) {
                // Get path after the base path
                const relPath = fullPath.substring(onedrivePath.length);
                
                // Clean up the path - remove leading slashes
                let cleanPath = relPath;
                while (cleanPath.startsWith('\\') || cleanPath.startsWith('/')) {
                    cleanPath = cleanPath.substring(1);
                }
                
                // Extract only the directory part, not the filename
                const lastBackslashPos = cleanPath.lastIndexOf('\\');
                const folderPathOnly = lastBackslashPos > -1 ? cleanPath.substring(0, lastBackslashPos) : '';
                
                console.log('Final relative folder path:', folderPathOnly);
                return folderPathOnly;
            }
            
            // Extract directory structure after OneDrive
            const oneDriveMatch = onedrivePath.match(/OneDrive.*?[\\\\|\/]/i);
            if (oneDriveMatch && fullPath.includes(oneDriveMatch[0])) {
                // Find the position after OneDrive in the path
                const parts = fullPath.split(oneDriveMatch[0]);
                if (parts.length > 1) {
                    // Extract only the directory part
                    const pathAfterOneDrive = parts[1];
                    const lastBackslashPos = pathAfterOneDrive.lastIndexOf('\\');
                    return lastBackslashPos > -1 ? pathAfterOneDrive.substring(0, lastBackslashPos) : '';
                }
            }
                
            // Try to extract from specific patterns like 'OneDrive - Company Name'
            if (fullPath.includes('OneDrive -')) {
                const parts = fullPath.split('OneDrive -');
                if (parts.length > 1) {
                    const afterOneDrive = parts[1].split(/[\\\\\/]/);
                    // Skip company name and return only folder parts (not the filename)
                    if (afterOneDrive.length > 2) { // At least company + folder + filename
                        return afterOneDrive.slice(1, -1).join('\\');
                    }
                }
            }
            
            // Return just the parent folder without the filename
            const pathParts = fullPath.split(/[\\\\\/]/);
            if (pathParts.length >= 2) {
                return pathParts[pathParts.length - 2];
            }
            
            // Fallback to original path
            return fullPath;
        } catch (error) {
            console.error('Error processing path:', error);
            return fullPath;
        }
    },
    
    /**
     * Convert bytes to human-readable format
     * @param {number} bytes - Size in bytes
     * @returns {string} - Human-readable size (e.g. "5.2 MB")
     */
    humanizeSize: function(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        
        return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
    },

    /**
     * Show toast notification
     * @param {Object} appData - The app data context
     * @param {string} message - Message to display
     * @param {string} type - Toast type (success, error, info, warning)
     * @param {number} duration - How long to show the toast (ms)
     * @param {string|null} customId - Optional custom ID for the toast
     * @returns {string} - The toast ID
     */
    showToast: function(appData, message, type = 'success', duration = 2000, customId = null) {
        console.log('Showing toast:', message, type);
        const id = customId || Date.now() + Math.random().toString(36).substr(2, 5);
        const toast = { message, type, id };
        
        // Remove any existing toast with the same message to prevent duplicates
        appData.toasts = appData.toasts.filter(t => t.message !== message);
        
        // Add the new toast
        appData.toasts.push(toast);
        
        // Don't set a timeout for processing toasts with custom IDs if duration > 30000
        // They will be cleared manually when the operation completes
        if (!customId || duration <= 30000) {
            setTimeout(() => {
                appData.toasts = appData.toasts.filter(t => t.id !== toast.id);
            }, duration);
        }
        
        return id;
    },

    /**
     * Copy a path to the clipboard
     * @param {Object} appData - The app data context
     * @param {string} path - Path to copy
     */
    copyPathToClipboard: function(appData, path) {
        console.log('Copying path to clipboard:', path);
        navigator.clipboard.writeText(path)
            .then(() => {
                console.log('Path copied successfully');
                this.showToast(appData, 'Path copied to clipboard', 'success', 1500);
            })
            .catch(err => {
                console.error('Error copying path to clipboard:', err);
                this.showToast(appData, 'Failed to copy path to clipboard', 'error');
            });
    },

    /**
     * Try to detect the username from various sources
     * @param {string} onedrivePath - Current OneDrive path (if any)
     * @returns {string|null} - Detected username or null
     */
    detectUsername: function(onedrivePath) {
        // Check if there's an existing OneDrive path we can extract from
        if (onedrivePath) {
            const match = onedrivePath.match(/C:\\Users\\([^\\]+)/i);
            if (match && match[1]) {
                return match[1];
            }
        }
        
        // Try to get from localStorage (if previously stored)
        try {
            const savedUsername = localStorage.getItem('username');
            if (savedUsername) {
                return savedUsername;
            }
        } catch (e) {
            // Ignore storage access errors
        }
        
        return null; // Could not detect
    },

    /**
     * Recalculate statistics based on current file statuses
     * @param {Object} appData - The app data context
     */
    recalculateStats: function(appData) {
        // Recalculate stats based on current file statuses
        appData.stats.local_files = appData.files.filter(file => !file.is_cloud_only).length;
        appData.stats.remote_files = appData.files.filter(file => file.is_cloud_only).length;
        
        // Recalculate local size
        appData.stats.local_size = appData.files
            .filter(file => !file.is_cloud_only)
            .reduce((total, file) => total + file.size, 0);
        
        appData.stats.human_local_size = this.humanizeSize(appData.stats.local_size);
        appData.stats.potential_savings = appData.stats.human_local_size;
    }
};