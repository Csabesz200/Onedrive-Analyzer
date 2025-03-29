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
    },

    /**
     * Get an appropriate Lucide icon based on file type
     * @param {string} filename - The filename to analyze
     * @returns {string} - HTML for the Lucide icon
     */
    getFileTypeIcon: function(filename) {
        if (!filename) return this.getIconSvg('file');
        
        // Get the extension
        const ext = filename.split('.').pop().toLowerCase();
        let color = this.getFileColor(ext);

        // Document types
        const docTypes = ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages'];
        const spreadsheetTypes = ['xls', 'xlsx', 'csv', 'ods', 'numbers'];
        const presentationTypes = ['ppt', 'pptx', 'odp', 'key'];
        const pdfTypes = ['pdf'];
        const codeTypes = ['js', 'py', 'java', 'c', 'cpp', 'cs', 'php', 'html', 'css', 'rb', 'go', 'rs', 'ts', 'json', 'xml', 'sql', 'sh'];
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'webp', 'svg', 'raw', 'psd', 'ai', 'eps'];
        const videoTypes = ['mp4', 'mov', 'wmv', 'avi', 'mkv', 'flv', 'webm'];
        const audioTypes = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
        const archiveTypes = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'];
        const executableTypes = ['exe', 'msi', 'bat', 'com', 'app', 'dmg'];
        const databaseTypes = ['db', 'sqlite', 'mdb', 'accdb'];
        
        // Return appropriate icon based on type
        if (docTypes.includes(ext)) return this.getIconSvg('file-text', color);
        if (spreadsheetTypes.includes(ext)) return this.getIconSvg('table', color);
        if (presentationTypes.includes(ext)) return this.getIconSvg('presentation', color);
        if (pdfTypes.includes(ext)) return this.getIconSvg('file-text', color);
        if (codeTypes.includes(ext)) return this.getIconSvg('code', color);
        if (imageTypes.includes(ext)) return this.getIconSvg('image', color);
        if (videoTypes.includes(ext)) return this.getIconSvg('video', color);
        if (audioTypes.includes(ext)) return this.getIconSvg('music', color);
        if (archiveTypes.includes(ext)) return this.getIconSvg('archive', color);
        if (executableTypes.includes(ext)) return this.getIconSvg('terminal', color);
        if (databaseTypes.includes(ext)) return this.getIconSvg('database', color);
        
        // Default to generic file icon
        return this.getIconSvg('file', color);
    },

    /**
     * Defines file extension to color association
     * @param {string} ext - The file extension
     * @returns {string} - The color for the file icon
    */
    getFileColor: function(ext) {
        const colorMap = {
            'doc': '#29ABE2',
            'docx': '#29ABE2',
            'pdf': '#E22929',
            'xls': '#229954',
            'xlsx': '#229954',
            'ppt': '#E67E22',
            'pptx': '#E67E22',
            'jpg': '#F1C40F',
            'jpeg': '#F1C40F',
            'png': '#F1C40F',
            'mp4': '#9B59B6',
            'mov': '#9B59B6',
            'zip': '#34495E',
            'rar': '#34495E',
            'js': '#F3DE8A',
            'java': '#F3DE8A',
            'py': '#F3DE8A'
        };
        return colorMap[ext] || '#999999'; // Default gray
    },
    
    /**
     * Get SVG markup for a Lucide icon
     * @param {string} iconName - The name of the Lucide icon
     * @param {string} color - The color to apply to the icon
     * @returns {string} - The SVG markup
     */
    getIconSvg: function(iconName, color = '#999999') {
        const colorAttribute = `stroke="${color}"`;

        // Collection of Lucide icons as SVGs
        const icons = {
            'file': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`,
            'file-text': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>`,
            'table': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
            'presentation': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/></svg>`,
            'code': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
            'image': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
            'video': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg>`,
            'music': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
            'archive': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h8"/></svg>`,
            'terminal': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
            'database': `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" ${colorAttribute} stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`
        };
        
        // Return the icon or default file icon if not found
        return icons[iconName] || icons['file'];
    }
};