import os
import flask
from flask import jsonify, request
import humanize
from datetime import datetime

from .file_analyzer import DirectoryScanner, is_onedrive_cloud_only
from .onedrive_utils import make_file_cloud_only
from .config import get_onedrive_path, update_onedrive_path

# Global variable to track scan status
scan_status = {
    'status': 'Idle',
    'progress': 0,
    'current_directory': '',
    'files_processed': 0,
    'total_estimate': 100,
    'last_updated': None
}

def init_routes(app):
    """Initialize all API routes for the Flask application"""
    
    @app.route('/')
    def index():
        """Render the main page"""
        return flask.render_template('index.html')

    @app.route('/api/onedrive-path', methods=['GET'])
    def get_onedrive_path_route():
        """API endpoint to get the OneDrive path"""
        path = get_onedrive_path()
        return jsonify({
            'path': path,
            'configured': bool(path)
        })

    @app.route('/api/onedrive-path', methods=['POST'])
    def update_onedrive_path_route():
        """API endpoint to update the OneDrive path"""
        data = request.json
        new_path = data.get('path', '')
        
        # Validate the path
        if not new_path or not os.path.exists(new_path) or not os.path.isdir(new_path):
            return jsonify({
                'success': False,
                'message': 'Invalid or non-existent directory path'
            }), 400
        
        # Update the path in the config
        success = update_onedrive_path(new_path)
        
        return jsonify({
            'success': success,
            'path': new_path
        })

    @app.route('/api/scan-status')
    def api_scan_status():
        """API endpoint to get the current scan status"""
        global scan_status
        
        # If scan hasn't been started or is very old, reset status
        if scan_status['last_updated'] is None or \
           (datetime.now() - scan_status['last_updated']).total_seconds() > 300:  # 5 minutes timeout
            scan_status = {
                'status': 'Idle',
                'progress': 0,
                'current_directory': '',
                'files_processed': 0,
                'total_estimate': 100,
                'last_updated': None
            }
        
        return jsonify(scan_status)

    @app.route('/api/scan')
    def api_scan():
        """API endpoint to scan the OneDrive directory with pagination support"""
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        # Validate pagination parameters
        page = max(1, page)
        per_page = max(10, min(per_page, 500))  # Limit per page between 10 and 500
        
        # Get sorting parameters
        sort_by = request.args.get('sort_by', 'size')  # Default sorting by size
        sort_order = request.args.get('sort_order', 'desc')  # Default descending
        
        # Get filter parameters
        is_cloud_only = request.args.get('is_cloud_only', type=lambda v: v.lower() == 'true')
        
        # Get the OneDrive path from config
        onedrive_path = get_onedrive_path()
        
        # Check if OneDrive path is configured
        if not onedrive_path or not os.path.exists(onedrive_path) or not os.path.isdir(onedrive_path):
            return jsonify({
                'success': False,
                'message': 'OneDrive path is not configured or is invalid. Please configure it in the settings.'
            }), 400
        
        # Scan parameters
        max_depth = request.args.get('max_depth', default=2, type=int)
        use_threads = request.args.get('use_threads', default=True, type=lambda v: v.lower() == 'true')
        max_workers = request.args.get('max_workers', default=4, type=int)
        
        # Create a directory scanner with the global scan status
        directory_scanner = DirectoryScanner(scan_status)
        
        # Scan the directory
        files_info = directory_scanner.scan_directory(
            onedrive_path, 
            max_depth, 
            use_threads=use_threads, 
            max_workers=max_workers
        )
        
        # Apply filters
        filtered_files = files_info
        
        # Filter by cloud-only status if specified
        if is_cloud_only is not None:
            filtered_files = [f for f in filtered_files if f['is_cloud_only'] == is_cloud_only]
        
        # Sort files
        if sort_by == 'size':
            filtered_files.sort(key=lambda x: x['size'], reverse=(sort_order == 'desc'))
        elif sort_by == 'name':
            filtered_files.sort(key=lambda x: x['name'], reverse=(sort_order == 'desc'))
        elif sort_by == 'last_modified':
            filtered_files.sort(key=lambda x: x['last_modified'], reverse=(sort_order == 'desc'))
        
        # Custom sorting to prioritize local files
        def custom_sort_key(file):
            return (
                0 if not file.get('is_cloud_only', False) else 1,
                -file.get('size', 0)
            )
        
        filtered_files.sort(key=custom_sort_key)
        
        # Paginate
        total_files = len(filtered_files)
        total_pages = (total_files + per_page - 1) // per_page
        
        start_index = (page - 1) * per_page
        end_index = start_index + per_page
        paginated_files = filtered_files[start_index:end_index]
        
        # Calculate statistics for the total set
        total_files_count = len(files_info)
        local_files = sum(1 for file in files_info if not file.get('is_cloud_only', False))
        remote_files = sum(1 for file in files_info if file.get('is_cloud_only', False))
        total_size = sum(file.get('size', 0) for file in files_info)
        local_size = sum(file.get('size', 0) for file in files_info if not file.get('is_cloud_only', False))
        
        return jsonify({
            'files': paginated_files,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total_files': total_files,
                'total_pages': total_pages,
                'has_next': page < total_pages,
                'has_previous': page > 1
            },
            'stats': {
                'total_files': total_files_count,
                'local_files': local_files,
                'remote_files': remote_files,
                'total_size': total_size,
                'human_total_size': humanize.naturalsize(total_size),
                'local_size': local_size,
                'human_local_size': humanize.naturalsize(local_size),
                'potential_savings': humanize.naturalsize(local_size)
            }
        })

    @app.route('/api/free-space', methods=['POST'])
    def free_space():
        """API endpoint to free up space by making a file cloud-only"""
        file_path = request.json.get('path')
        verify_only = request.json.get('verify_only', False)
        
        if not file_path or not os.path.exists(file_path):
            return jsonify({'success': False, 'message': 'File not found'})
        
        try:
            # If verify_only flag is set, just check if the file is cloud-only
            if verify_only:
                is_cloud_only = is_onedrive_cloud_only(file_path)
                return jsonify({
                    'success': True,
                    'is_cloud_only': is_cloud_only,
                    'message': 'File status checked successfully'
                })
            
            # Otherwise, try to make the file cloud-only
            success, message = make_file_cloud_only(file_path)
            
            # Double-check the file status after the operation
            is_cloud_only = is_onedrive_cloud_only(file_path)
            
            return jsonify({
                'success': success,
                'message': message,
                'is_cloud_only': is_cloud_only
            })
        except Exception as e:
            error_msg = f"Exception making file cloud-only: {str(e)}"
            print(error_msg)
            return jsonify({'success': False, 'message': error_msg})

    @app.route('/api/free-multiple', methods=['POST'])
    def free_multiple():
        """API endpoint to free up space for multiple files"""
        file_paths = request.json.get('paths', [])
        results = []
        
        for file_path in file_paths:
            try:
                if os.path.exists(file_path):
                    # Make file cloud-only using our new function
                    success, message = make_file_cloud_only(file_path)
                    
                    results.append({
                        'path': file_path,
                        'success': success,
                        'message': message
                    })
                else:
                    results.append({
                        'path': file_path,
                        'success': False,
                        'message': 'File not found'
                    })
            except Exception as e:
                results.append({
                    'path': file_path,
                    'success': False,
                    'message': str(e)
                })
        
        return jsonify({
            'success': any(r['success'] for r in results),
            'results': results
        })