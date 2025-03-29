/**
 * Direct path display manipulation
 * This file adds functions to directly modify file paths
 * after the app has loaded, to ensure relative paths are displayed.
 */

// Global function to get relative path (can be called from anywhere)
window.getRelativePath = function(fullPath) {
    // If no path, return empty string
    if (!fullPath) return '';
    
    try {
        // If we have a configured OneDrive path, use it as a base
        if (window.app && window._x_dataStack && window._x_dataStack[0] && window._x_dataStack[0].onedrivePath) {
            const onedrivePath = window._x_dataStack[0].onedrivePath;
            if (onedrivePath && fullPath.startsWith(onedrivePath)) {
                // Get path relative to OneDrive path
                let relativePath = fullPath.substring(onedrivePath.length);
                // Remove leading slashes or backslashes
                while (relativePath.startsWith('\\') || relativePath.startsWith('/')) {
                    relativePath = relativePath.substring(1);
                }
                
                // Get the folder path without the filename
                const folders = relativePath.split(/[\\\/]/);
                if (folders.length > 1) {
                    const folderPath = folders.slice(0, -1).join('\\');
                    console.log('Extracted folder path from app path:', folderPath);
                    return folderPath;
                }
                
                console.log('Extracted path relative to configured OneDrive path:', relativePath);
                return relativePath;
            }
        }
        
        // Try to find OneDrive part if we don't have a configured base path
        if (fullPath.includes('OneDrive')) {
            // Extract everything after 'OneDrive - COMPANY NAME\' pattern
            const match = fullPath.match(/OneDrive.*?[\\\/](.*)/i);
            if (match && match[1]) {
                // Get the path part without the filename
                const pathParts = match[1].split(/[\\\/]/);
                if (pathParts.length > 1) {
                    const folderPath = pathParts.slice(0, -1).join('\\');
                    console.log('Extracted folder path after OneDrive:', folderPath);
                    return folderPath;
                }
                console.log('Extracted path after OneDrive:', match[1]);
                return match[1];
            }
        }
        
        // If no OneDrive pattern found, just return parent folder and filename
        const parts = fullPath.split(/[\\\/]/);
        if (parts.length >= 2) {
            const result = parts.slice(-2).join('\\');
            console.log('Extracted last two path components:', result);
            return result;
        }
        
        return fullPath;
    } catch (error) {
        console.error('Error processing path:', error);
        return fullPath;
    }
};

document.addEventListener('DOMContentLoaded', function() {
    // Log that we're running
    console.log('Path fixer script loaded and running');
    
    // Wait for Alpine.js to initialize and data to load
    setTimeout(function() {
        console.log('Running path fixer');
        
        // Add path processing to copy buttons
        const copyButtons = document.querySelectorAll('.btn-ghost');
        for (const button of copyButtons) {
            button.addEventListener('click', function() {
                console.log('Copy button clicked, showing shortened path');
            });
        }
        
        // Try to find any path display elements
        processPathsFromDOM();
    }, 2000);  // Wait 2 seconds to ensure app is loaded
});

/**
 * Process paths directly from the DOM
 */
function processPathsFromDOM() {
    console.log('Processing paths from DOM elements');
    
    // Set up a mutation observer to process the DOM as it changes
    const observer = new MutationObserver(function(mutations) {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Go through any new nodes and fix the path display
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {  // Element node
                        // Handle copy path buttons
                        const buttons = node.querySelectorAll('.btn-ghost');
                        for (const button of buttons) {
                            button.addEventListener('click', function(e) {
                                // Get the parent tr or card
                                const parentElement = button.closest('tr') || button.closest('.card');
                                if (parentElement) {
                                    console.log('Copy button clicked, parent:', parentElement);
                                }
                            });
                        }
                    }
                }
            }
        }
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Add our custom function to Alpine.js global scope
    if (window.Alpine) {
        window.Alpine.data('fileData', () => ({
            getShortPath(path) {
                return window.getRelativePath(path);
            }
        }));
    }
}
