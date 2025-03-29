"""
SQLite Database Manager for OneDrive Analyzer
Handles caching scan results and retrieving paginated data
"""
import os
import sqlite3
import json
import time
from datetime import datetime
from contextlib import contextmanager
from flask import g, current_app

# Database file location
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                       'data', 'onedrive_cache.db')

# Ensure the data directory exists
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def get_db():
    """Get a database connection"""
    if 'db' not in g:
        g.db = sqlite3.connect(
            DB_PATH,
            detect_types=sqlite3.PARSE_DECLTYPES
        )
        g.db.row_factory = sqlite3.Row
    
    return g.db

@contextmanager
def get_db_connection():
    """Context manager for database connections outside of request context"""
    conn = sqlite3.connect(
        DB_PATH,
        detect_types=sqlite3.PARSE_DECLTYPES
    )
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def close_db(e=None):
    """Close the database connection"""
    db = g.pop('db', None)
    
    if db is not None:
        db.close()

def init_db():
    """Initialize the database with necessary tables"""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Create table for scan results
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS scan_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            onedrive_path TEXT NOT NULL,
            max_depth INTEGER NOT NULL,
            scan_time TIMESTAMP NOT NULL,
            scan_params TEXT NOT NULL,
            stats TEXT NOT NULL,
            files_json TEXT,
            is_active INTEGER DEFAULT 1
        )
        ''')
        
        # Create table for individual files (for better query performance)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS scanned_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            name TEXT NOT NULL,
            size INTEGER NOT NULL,
            is_cloud_only INTEGER NOT NULL,
            last_modified TIMESTAMP NOT NULL,
            relative_folder_path TEXT NOT NULL,
            parent_folder TEXT NOT NULL,
            FOREIGN KEY (scan_id) REFERENCES scan_results (id) ON DELETE CASCADE
        )
        ''')
        
        # Create indices for faster queries
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_scan_id ON scanned_files (scan_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_is_cloud_only ON scanned_files (is_cloud_only)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_size ON scanned_files (size)')
        
        conn.commit()

def store_scan_results(onedrive_path, files_info, stats, max_depth, scan_params):
    """
    Store scan results in the database
    Args:
        onedrive_path: Path to OneDrive folder
        files_info: List of file information dictionaries
        stats: Dictionary with scan statistics
        max_depth: Maximum scan depth
        scan_params: Dictionary with additional scan parameters
    Returns:
        scan_id: ID of the stored scan
    """
    try:
        # Convert complex objects to JSON for storage
        stats_json = json.dumps(stats)
        scan_params_json = json.dumps(scan_params)
        
        with get_db_connection() as conn:
            # Mark previous scans for this path as inactive
            conn.execute(
                'UPDATE scan_results SET is_active = 0 WHERE onedrive_path = ?',
                (onedrive_path,)
            )
            
            # Insert new scan metadata
            cursor = conn.execute(
                '''
                INSERT INTO scan_results 
                (onedrive_path, max_depth, scan_time, scan_params, stats, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
                ''',
                (onedrive_path, max_depth, datetime.now(), scan_params_json, stats_json)
            )
            scan_id = cursor.lastrowid
            print(f"Created new scan record with ID: {scan_id}")
            
            # Insert file records in batches for better performance
            batch_size = 100
            for i in range(0, len(files_info), batch_size):
                batch = files_info[i:i+batch_size]
                
                # Create a list of tuples for executemany
                records = []
                for file_info in batch:
                    try:
                        # Ensure we have a valid timestamp for last_modified
                        last_modified = file_info.get('last_modified')
                        if isinstance(last_modified, str):
                            try:
                                # Try to parse the timestamp string
                                last_modified = datetime.strptime(last_modified, '%Y-%m-%d %H:%M:%S')
                            except ValueError:
                                # If parsing fails, use current time
                                last_modified = datetime.now()
                        elif not isinstance(last_modified, datetime):
                            last_modified = datetime.now()
                            
                        records.append((
                            scan_id,
                            file_info['path'],
                            file_info['name'],
                            int(file_info['size']),
                            1 if file_info['is_cloud_only'] else 0,
                            last_modified,
                            file_info.get('relative_folder_path', ''),
                            file_info.get('parent_folder', '')
                        ))
                    except Exception as e:
                        print(f"Error preparing file record: {e}. File: {file_info.get('path', 'Unknown')}")
                
                # Insert batch
                if records:
                    conn.executemany(
                        '''
                        INSERT INTO scanned_files
                        (scan_id, file_path, name, size, is_cloud_only, last_modified,
                        relative_folder_path, parent_folder)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''',
                        records
                    )
                    print(f"Inserted batch of {len(records)} files")
            
            conn.commit()
            print(f"Database commit complete. Total files stored: {len(files_info)}")
            return scan_id
    except Exception as e:
        print(f"Error storing scan results: {e}")
        return None

def get_scan_results(onedrive_path, page=1, per_page=50, filters=None, sort_options=None):
    """
    Get paginated scan results from the database
    Args:
        onedrive_path: Path to OneDrive folder
        page: Page number (1-based)
        per_page: Items per page
        filters: Dictionary with filter options
        sort_options: Dictionary with sorting options
    Returns:
        Dictionary with:
            - files: List of file information for the current page
            - pagination: Pagination details
            - stats: Scan statistics
            - last_scan_time: When the data was last scanned
    """
    try:
        with get_db_connection() as conn:
            # Get the most recent active scan for this path
            scan_row = conn.execute(
                '''
                SELECT id, scan_time, stats
                FROM scan_results
                WHERE onedrive_path = ? AND is_active = 1
                ORDER BY scan_time DESC LIMIT 1
                ''',
                (onedrive_path,)
            ).fetchone()
            
            if not scan_row:
                print(f"No active scan found for {onedrive_path}")
                return None  # No scan results found
                
            scan_id = scan_row['id']
            stats = json.loads(scan_row['stats'])
            last_scan_time = scan_row['scan_time']
            
            # Build the query with filters
            query = 'SELECT * FROM scanned_files WHERE scan_id = ?'
            params = [scan_id]
            
            if filters:
                if 'is_cloud_only' in filters and filters['is_cloud_only'] is not None:
                    query += ' AND is_cloud_only = ?'
                    params.append(1 if filters['is_cloud_only'] else 0)
                    
                if 'search_query' in filters and filters['search_query']:
                    search_term = f'%{filters["search_query"]}%'
                    query += ' AND (name LIKE ? OR file_path LIKE ?)'
                    params.extend([search_term, search_term])
            
            # Get total count for pagination
            count_query = f'SELECT COUNT(*) as count FROM scanned_files WHERE scan_id = ?'
            count_params = [scan_id]
            
            if filters:
                if 'is_cloud_only' in filters and filters['is_cloud_only'] is not None:
                    count_query += ' AND is_cloud_only = ?'
                    count_params.append(1 if filters['is_cloud_only'] else 0)
                    
                if 'search_query' in filters and filters['search_query']:
                    search_term = f'%{filters["search_query"]}%'
                    count_query += ' AND (name LIKE ? OR file_path LIKE ?)'
                    count_params.extend([search_term, search_term])
                    
            count_row = conn.execute(count_query, count_params).fetchone()
            
            total_items = count_row['count'] if count_row else 0
            print(f"Total items: {total_items}")
            
            # Add sorting
            if sort_options:
                column = sort_options.get('column', 'size')
                direction = sort_options.get('direction', 'desc')
                
                # Map user-friendly column names to database columns
                column_mapping = {
                    'size': 'size',
                    'name': 'name',
                    'last_modified': 'last_modified'
                }
                
                db_column = column_mapping.get(column, 'size')
                
                # Validate direction
                if direction not in ('asc', 'desc'):
                    direction = 'desc'
                    
                query += f' ORDER BY {db_column} {direction.upper()}'
                
                # Add secondary sort for consistency
                if db_column != 'name':
                    query += ', name ASC'
            else:
                # Default sorting
                query += ' ORDER BY size DESC'
            
            # Add pagination
            offset = (page - 1) * per_page
            query += ' LIMIT ? OFFSET ?'
            params.extend([per_page, offset])
            
            print(f"SQL Query: {query}")
            print(f"Params: {params}")
            
            # Execute the query
            rows = conn.execute(query, params).fetchall()
            print(f"Found {len(rows)} rows for page {page}")
            
            # Convert rows to dictionaries
            files = []
            for row in rows:
                files.append({
                    'path': row['file_path'],
                    'name': row['name'],
                    'size': row['size'],
                    'is_cloud_only': bool(row['is_cloud_only']),
                    'last_modified': row['last_modified'],
                    'relative_folder_path': row['relative_folder_path'],
                    'parent_folder': row['parent_folder'],
                    # Add human_size for consistency with API
                    'human_size': format_file_size(row['size'])
                })
            
            # Calculate pagination
            total_pages = (total_items + per_page - 1) // per_page if per_page > 0 else 1
            
            pagination = {
                'page': page,
                'per_page': per_page,
                'total_files': total_items,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_previous': page > 1
            }
            
            print(f"Pagination: {pagination}")
            
            return {
                'files': files,
                'pagination': pagination,
                'stats': stats,
                'last_scan_time': last_scan_time
            }
    except Exception as e:
        print(f"Error getting scan results from database: {e}")
        return None

def clear_old_scans(days_to_keep=7):
    """Delete scan results older than the specified number of days"""
    with get_db_connection() as conn:
        cutoff_time = datetime.now().timestamp() - (days_to_keep * 24 * 60 * 60)
        conn.execute(
            'DELETE FROM scan_results WHERE scan_time < ? AND is_active = 0',
            (cutoff_time,)
        )
        conn.commit()

def format_file_size(size_bytes):
    """Format file size in bytes to human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024 or unit == 'TB':
            break
        size_bytes /= 1024
    
    return f"{size_bytes:.1f} {unit}"
