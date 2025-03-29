import os
import re
import ctypes
import subprocess
from datetime import datetime
import humanize
import threading
from concurrent.futures import ThreadPoolExecutor

def is_onedrive_cloud_only(file_path):
    """
    More reliably determine if a OneDrive file is cloud-only.
    Uses multiple approaches to increase accuracy.
    """
    # Windows API constants for file attributes
    FILE_ATTRIBUTE_PINNED = 0x00080000
    FILE_ATTRIBUTE_UNPINNED = 0x00100000
    FILE_ATTRIBUTE_REPARSE_POINT = 0x00400000

    # Method 3: Check for reparse point attribute first (Based on log, this is most reliable)
    try:
        # Try to use ctypes to access Windows API
        file_attributes = ctypes.windll.kernel32.GetFileAttributesW(file_path)
        if file_attributes != 0xFFFFFFFF:  # INVALID_FILE_ATTRIBUTES
            # Check for specific OneDrive reparse point attribute
            if file_attributes & FILE_ATTRIBUTE_REPARSE_POINT:
                return True
            # Also check for FILE_ATTRIBUTE_UNPINNED
            if file_attributes & FILE_ATTRIBUTE_UNPINNED:
                return True
    except Exception as e:
        print(f"Method 3 failed: {str(e)}")
    
    # Method 1: Check file attributes using attrib command
    try:
        result = subprocess.run(['attrib', file_path], capture_output=True, text=True, timeout=3)
        if result.returncode == 0:
            output = result.stdout.strip()
            # Check for 'U' (unpinned) attribute without 'P' (pinned) attribute
            if 'U' in output and 'P' not in output:
                print(f"Method 1 (attrib): File is cloud-only - {file_path}")
                return True
    except Exception as e:
        print(f"Method 1 failed: {str(e)}")
    
    # Method 2: Check file size and reparse point status
    try:
        actual_size = os.path.getsize(file_path)
        # Cloud-only files often have reparse points and very small size
        # Changed from exact 0 to a small threshold to catch more cloud files
        if os.path.isfile(file_path) and actual_size < 1024:  # Less than 1KB might be cloud-only
            return True
    except Exception as e:
        print(f"Method 2 failed: {str(e)}")
    
    # If all methods indicate the file is not cloud-only, return False
    return False

def extract_folder_path(file_path, base_path=None):
    """
    Extract the folder path similar to what the frontend does with getRelativePath
    """
    # If base_path is provided and file_path starts with it, get the relative path
    if base_path and file_path.startswith(base_path):
        # Get just the folder part, excluding the filename
        folder_only = os.path.dirname(file_path)
        rel_path = os.path.relpath(folder_only, base_path)
        if rel_path and rel_path != '.':
            return rel_path
    
    # Try to extract path after 'OneDrive'
    if 'OneDrive' in file_path:
        # Match everything after OneDrive (including company name if present)
        match = re.search(r'OneDrive(?:\s*-\s*[^\\\/]+)?[\\\/](.+)[\\\/][^\\\/]+$', file_path, re.IGNORECASE)
        if match and match.group(1):
            return match.group(1)
    
    # Fallback to parent folder
    return os.path.basename(os.path.dirname(file_path))

def get_file_attributes(file_path, base_path=None):
    """Get file attributes including size and status (local or remote)"""
    try:
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Use our more reliable function to check cloud status
        is_cloud_only = is_onedrive_cloud_only(file_path)
        
        # Calculate last modified time
        last_modified = os.path.getmtime(file_path)
        modified_date = datetime.fromtimestamp(last_modified).strftime('%Y-%m-%d %H:%M:%S')
        
        # Calculate file extension
        _, ext = os.path.splitext(file_path)
        ext = ext.lower() if ext else ''
        
        # Get file name and parent folder
        file_name = os.path.basename(file_path)
        parent_folder = os.path.basename(os.path.dirname(file_path))
        
        # Get relative folder path using our dedicated function
        relative_folder_path = extract_folder_path(file_path, base_path)
        
        # Humanize the file size
        human_size = humanize.naturalsize(file_size)
        
        return {
            'path': file_path,
            'name': file_name,
            'parent_folder': parent_folder,
            'relative_folder_path': relative_folder_path,
            'extension': ext,
            'size': file_size,
            'human_size': human_size,
            'is_cloud_only': is_cloud_only,
            'last_modified': modified_date
        }
    except Exception as e:
        print(f"Error getting file attributes for {file_path}: {e}")
        return {
            'path': file_path,
            'name': os.path.basename(file_path),
            'parent_folder': os.path.basename(os.path.dirname(file_path)),
            'relative_folder_path': os.path.basename(os.path.dirname(file_path)),
            'extension': '',
            'size': 0,
            'human_size': '0 B',
            'is_cloud_only': False,
            'last_modified': '',
            'error': str(e)
        }

class DirectoryScanner:
    """Manages scanning of directories for file information"""
    def __init__(self, scan_status_tracker=None):
        """
        Initialize the directory scanner
        
        Args:
            scan_status_tracker (dict, optional): A dictionary to track scan progress
        """
        self.scan_status = scan_status_tracker or {
            'status': 'Idle',
            'progress': 0,
            'current_directory': '',
            'files_processed': 0,
            'total_estimate': 100,
            'last_updated': None
        }

    def scan_directory(self, directory_path, max_depth=-1, current_depth=0, use_threads=True, max_workers=4):
        """Recursively scan a directory and return file information
        
        Args:
            directory_path: The path to scan
            max_depth: Maximum recursion depth (-1 for unlimited recursion)
            current_depth: Current recursion depth
            use_threads: Whether to use threading for parallelism
            max_workers: Maximum number of worker threads
            
        Returns:
            List of file information dictionaries
        """
        # Update scan status with current directory
        self.scan_status['current_directory'] = directory_path
        self.scan_status['last_updated'] = datetime.now()
        
        # If this is the top level, estimate the total number of files
        if current_depth == 0:
            self.scan_status['status'] = 'Estimating total files...'
            total_files_estimate = 0
            
            try:
                # Quick estimation of file count (without full recursion)
                for root, dirs, files in os.walk(directory_path):
                    total_files_estimate += len(files)
                    
                    # Just check top level and a reasonable number of subdirectories for a rough estimate
                    if len(dirs) > 30:
                        dirs[:] = dirs[:30]  # Increase subdirectory limit for better estimation
                    
                    # Break after reasonable estimation to avoid long initial delay
                    if total_files_estimate > 5000:
                        break
            except Exception as e:
                print(f"Error estimating file count: {e}")
                total_files_estimate = 100  # Default estimate
            
            self.scan_status['total_estimate'] = max(100, total_files_estimate)
            self.scan_status['files_processed'] = 0
            self.scan_status['status'] = 'Starting scan...'
        
        # List to store file information
        files_info = []
        
        try:
            # Get all entries in the current directory
            entries = list(os.scandir(directory_path))
            
            # Process files in the current directory
            file_entries = [e for e in entries if e.is_file()]
            dir_entries = [e for e in entries if e.is_dir()]
            
            # Process files (can be parallelized)
            if use_threads and len(file_entries) > 10 and current_depth == 0:  # Only use threads for large directories at top level
                # Create a ThreadPoolExecutor to process files in parallel
                self.scan_status['status'] = f"Processing {len(file_entries)} files with {max_workers} threads..."
                
                # Define a worker function to process a batch of files
                def process_file_batch(batch):
                    batch_results = []
                    for i, entry in enumerate(batch):
                        self.scan_status['current_directory'] = entry.path
                        try:
                            file_info = get_file_attributes(entry.path, directory_path)
                            batch_results.append(file_info)
                            # Update processed count (thread-safe through atomic operations)
                            self.scan_status['files_processed'] += 1
                        except Exception as e:
                            print(f"Error processing file {entry.path}: {e}")
                    return batch_results
                
                # Split files into batches for each worker
                batch_size = max(1, len(file_entries) // max_workers)
                batches = [file_entries[i:i + batch_size] for i in range(0, len(file_entries), batch_size)]
                
                # Process batches in parallel
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    batch_results = list(executor.map(process_file_batch, batches))
                
                # Flatten the results
                for batch in batch_results:
                    files_info.extend(batch)
            else:
                # Process files sequentially
                for i, entry in enumerate(file_entries):
                    # Update progress indication
                    progress_pct = (i / len(entries)) * 100 if entries else 0
                    self.scan_status['progress'] = progress_pct
                    
                    self.scan_status['status'] = f"Processing file {self.scan_status['files_processed'] + 1} of ~{self.scan_status['total_estimate']}"
                    self.scan_status['current_directory'] = entry.path
                    
                    try:
                        file_info = get_file_attributes(entry.path, directory_path)
                        files_info.append(file_info)
                        self.scan_status['files_processed'] += 1
                    except Exception as e:
                        print(f"Error processing file {entry.path}: {e}")
            
            # Process subdirectories (can be done in parallel for deeper levels)
            if max_depth == -1 or current_depth < max_depth:  # Fixed condition for unlimited depth
                if use_threads and len(dir_entries) > 4 and (max_depth == -1 or current_depth < 5):  # Allow threading for deeper levels
                    self.scan_status['status'] = f"Scanning {len(dir_entries)} subdirectories in parallel..."
                    
                    # Define a worker function to scan a directory
                    def scan_subdir(entry):
                        self.scan_status['current_directory'] = entry.path
                        try:
                            return self.scan_directory(entry.path, max_depth, current_depth + 1, use_threads, max_workers)
                        except Exception as e:
                            print(f"Error scanning subdirectory {entry.path}: {e}")
                            return []
                    
                    # Scan subdirectories in parallel with limited concurrency
                    concurrent_dirs = min(len(dir_entries), max_workers)
                    with ThreadPoolExecutor(max_workers=concurrent_dirs) as executor:
                        subdir_results = list(executor.map(scan_subdir, dir_entries))
                    
                    # Flatten the results from all subdirectories
                    for subdir_files in subdir_results:
                        files_info.extend(subdir_files)
                else:
                    # Process subdirectories sequentially
                    for entry in dir_entries:
                        self.scan_status['status'] = f"Scanning folder: {os.path.basename(entry.path)}"
                        self.scan_status['current_directory'] = entry.path
                        
                        sub_files = self.scan_directory(entry.path, max_depth, current_depth + 1, use_threads, max_workers)
                        files_info.extend(sub_files)
        except Exception as e:
            self.scan_status['status'] = f"Error: {str(e)}"
            print(f"Error scanning directory {directory_path}: {e}")
        
        # Update completion status if we're at the top level
        if current_depth == 0:
            self.scan_status['status'] = 'Scan complete'
            self.scan_status['progress'] = 100
        
        return files_info