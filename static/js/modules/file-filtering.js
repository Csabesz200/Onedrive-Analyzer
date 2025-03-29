/**
 * File filtering and sorting functionality
 */

// Make filtering functions available globally
window.oneDriveFiltering = {

/**
 * Update sort settings based on the select input value
 * @param {Object} appData - The app data context
 * @param {string} value - Sort value in format "column:direction"
 */
updateSort: function(appData, value) {
    // Parse the value which should be in format "column:direction"
    const parts = value.split(':');
    if (parts.length === 2) {
        appData.sortColumn = parts[0];
        appData.sortDirection = parts[1];
    }
},

/**
 * Sort files by a specific column
 * @param {Object} appData - The app data context
 * @param {string} column - Column to sort by
 */
sortBy: function(appData, column) {
    if (appData.sortColumn === column) {
        // Toggle direction if clicking the same column
        appData.sortDirection = appData.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // Set new column and default to ascending
        appData.sortColumn = column;
        appData.sortDirection = 'asc';
    }
},

/**
 * Filter files based on current filter settings
 * @param {Array} files - Array of files to filter
 * @param {Object} filterOptions - Object containing filter options
 * @returns {Array} - Filtered and sorted files
 */
getFilteredFiles: function(files, filterOptions) {
    const {
        filterStatus, 
        searchQuery, 
        sortColumn, 
        sortDirection, 
        prioritizeLocalFiles,
        groupByFolder
    } = filterOptions;
    
    let filtered = [...files];
    
    // Filter by status
    if (filterStatus === 'local') {
        filtered = filtered.filter(file => !file.is_cloud_only);
    } else if (filterStatus === 'cloud') {
        filtered = filtered.filter(file => file.is_cloud_only);
    }
    
    // Filter by search query
    if (searchQuery && searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(file => 
            file.name.toLowerCase().includes(query) || 
            file.path.toLowerCase().includes(query)
        );
    }
    
    // Sort files
    filtered.sort((a, b) => {
        
        // Prioritize local files (not cloud-only) if the setting is enabled
        if (prioritizeLocalFiles) {
            if (!a.is_cloud_only && b.is_cloud_only) {
                return -1; // a (local) comes before b (cloud)
            }
            if (a.is_cloud_only && !b.is_cloud_only) {
                return 1; // b (local) comes before a (cloud)
            }
        }
        
        // Special case if we're grouping by folder
        if (groupByFolder && sortColumn !== 'parent_folder') {
            // First sort by parent folder
            const folderComparison = a.parent_folder.localeCompare(b.parent_folder);
            if (folderComparison !== 0) {
                return sortDirection === 'asc' ? folderComparison : -folderComparison;
            }
            // Then sort by the selected column within each folder group
        }
        
        let aValue = a[sortColumn];
        let bValue = b[sortColumn];
        
        // Handle special case for sorting by name
        if (sortColumn === 'name') {
            aValue = aValue.toLowerCase();
            bValue = bValue.toLowerCase();
        }
        
        // Handle special case for parent folder
        if (sortColumn === 'parent_folder') {
            aValue = a.parent_folder.toLowerCase();
            bValue = b.parent_folder.toLowerCase();
        }
        
        // Handle numeric values
        if (sortColumn === 'size') {
            aValue = parseInt(aValue);
            bValue = parseInt(bValue);
        }
        
        // Boolean values
        if (typeof aValue === 'boolean') {
            aValue = aValue ? 1 : 0;
            bValue = bValue ? 1 : 0;
        }
        
        // Do the comparison
        if (aValue < bValue) {
            return sortDirection === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });
    
    return filtered;
},

/**
 * Group files by folder
 * @param {Array} files - Files to group
 * @returns {Object} - Files grouped by parent folder
 */
groupFilesByFolder: function(files) {
    const grouped = {};
    
    files.forEach(file => {
        if (!grouped[file.parent_folder]) {
            grouped[file.parent_folder] = [];
        }
        grouped[file.parent_folder].push(file);
    });
    
    return grouped;
}
}; // End of window.oneDriveFiltering