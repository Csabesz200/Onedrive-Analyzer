import os
import time
import subprocess
from .file_analyzer import is_onedrive_cloud_only

def make_file_cloud_only(file_path):
    """
    Make a file cloud-only using multiple methods to ensure success.
    Returns a tuple (success, message)
    """
    print(f"Attempting to make cloud-only: {file_path}")
    
    # Check if file already cloud-only
    if is_onedrive_cloud_only(file_path):
        return (True, "File is already cloud-only")
    
    # Method 1: Use the attrib command with additional options
    try:
        # Run the command with more verbose output
        print(f"Running attrib +U -P on {file_path}")
        result = subprocess.run(['attrib', '+U', '-P', file_path], 
                               capture_output=True, text=True, timeout=10)
        
        print(f"Attrib command output: {result.stdout}")
        print(f"Attrib command error: {result.stderr}")
        
        if result.returncode == 0:
            # Wait a moment for OneDrive to process the change
            time.sleep(2)
            
            # Verify the change worked
            if is_onedrive_cloud_only(file_path):
                return (True, "Successfully made file cloud-only with attrib command")
            else:
                print("Attrib command returned success but file is still not cloud-only")
        else:
            print(f"Attrib command failed with return code: {result.returncode}")
    except Exception as e:
        print(f"Exception with attrib command: {str(e)}")
    
    # Method 2: Use PowerShell with FileSystem.IO method
    try:
        print("Trying PowerShell method...")
        # Use the FileSystem.IO method which might be more reliable
        ps_command = f'powershell -Command "& {{$item = Get-Item \"{file_path}\"; $attribs = [System.IO.FileAttributes]::Archive -bor [System.IO.FileAttributes]::Offline; Set-ItemProperty -Path \"{file_path}\" -Name Attributes -Value $attribs; Write-Output \"PowerShell attributes set\"}}"'
        
        result = subprocess.run(ps_command, shell=True, capture_output=True, text=True, timeout=15)
        print(f"PowerShell output: {result.stdout}")
        print(f"PowerShell error: {result.stderr}")
        
        # Wait a moment for OneDrive to process the change
        time.sleep(2)
        
        # Verify the change worked
        if is_onedrive_cloud_only(file_path):
            return (True, "Successfully made file cloud-only with PowerShell FileSystem.IO")
    except Exception as e:
        print(f"Exception with PowerShell FileSystem.IO method: {str(e)}")
    
    # Method 3: Try using OneDrive's built-in free up space command via PowerShell
    try:
        print("Trying OneDrive FreeSpace method...")
        # This uses OneDrive's own functionality to free up space
        # The exact command might depend on your OneDrive version
        ps_command = f'powershell -Command "& {{$folder = Split-Path \"{file_path}\"; Start-Process \"$env:LOCALAPPDATA\Microsoft\OneDrive\OneDrive.exe\" -ArgumentList \"/FreeSpace:`$folder\"}}"'
        
        result = subprocess.run(ps_command, shell=True, timeout=15)
        
        # OneDrive might take a while to process this
        print("Waiting for OneDrive to process the free space command...")
        time.sleep(5)
        
        # Verify the change worked
        if is_onedrive_cloud_only(file_path):
            return (True, "Successfully made file cloud-only with OneDrive FreeSpace command")
    except Exception as e:
        print(f"Exception with OneDrive FreeSpace method: {str(e)}")
    
    # If we're here, all methods failed
    # Return more detailed error information
    error_message = "Failed to make file cloud-only after multiple attempts. Check if:"
    error_message += "\n- You have sufficient permissions"
    error_message += "\n- The file is not currently in use"
    error_message += "\n- OneDrive sync is working properly"
    error_message += "\n- The file is part of a synced OneDrive folder"
    
    print(error_message)
    return (False, error_message)
