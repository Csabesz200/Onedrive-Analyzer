# ☁️ OneDrive Space Saver 🧹

A Flask-based web application that analyzes your OneDrive folder, showing which files are stored locally versus in the cloud, and helping you free up disk space with simple controls.

![OneDrive Analyzer Screenshot](docs/Demo.mov)

## ✨ What This Tool Does

OneDrive's Files On-Demand feature lets you keep files in the cloud while accessing them from your local device. However, many files end up being stored locally, taking up valuable disk space. This tool helps you:

1.  **🔎 Scan your OneDrive folder** to identify which files are stored locally and which are "cloud-only"
2.  **📊 See detailed statistics** about your storage usage and potential space savings
3.  **🚀 Free up space** by making files "cloud-only" with a single click
4.  **🔍 Search and filter files** to quickly find specific items

## 🌟 Features

-   **⚙️ Configurable OneDrive path** without editing code
-   **♾️ Unlimited folder depth recursion** option
-   **🎨 Easy-to-use web interface** with modern design using Tailwind CSS
-   **📈 Detailed storage statistics** showing local vs. cloud usage
-   **🗂️ File browser** with sorting, filtering, and search capabilities
-   **🪄 One-click space saving** for individual files or batch operations
-   **🚦 Status indicators** clearly showing which files are using local storage
-   **🗄️ File type recognition** with appropriate icons for common file types
-   **📱 Responsive design** that works on desktop and mobile devices

## 🧰 Requirements

-   Windows operating system with OneDrive installed
-   Python 3.8 or higher
-   OneDrive for Business or Personal with Files On-Demand enabled

## 🚀 Quick Start

1.  **Clone or download this repository**

2.  **Set up a Python virtual environment** (recommended):

    ```bash
    python -m venv venv
    venv\Scripts\activate
    ```

3.  **Install required dependencies**:

    ```bash
    pip install -r requirements.txt
    ```

4.  **Start the application**:

    ```bash
    python app.py
    ```

    Or use the included batch file:

    ```bash
    run_app.bat
    ```

5.  **Access the web interface and configure OneDrive path**:

    -   Open your browser and go to: `http://127.0.0.1:5000`
    -   On first run, you'll be prompted to set your OneDrive path
    -   Enter the full path to your OneDrive folder and click Save

## 🧑‍💻 How to Use

1.  **Configure your OneDrive path** if not already set up
2.  **Set scan depth** using the dropdown menu (higher values will scan more subfolders, or choose "Unlimited")
3.  **Click "Scan OneDrive Files"** to analyze your OneDrive folder
4.  **View the storage overview** to see statistics about your file storage
5.  **Browse your files** in the file list table
    -   Sort by clicking column headers
    -   Filter using the buttons at the bottom
    -   Search using the search box
6.  **Free up space** by:
    -   Clicking "Make Cloud-only" for individual files
    -   Clicking "Free All Local Files" to convert all files at once

## ⚙️ How It Works

This application leverages Windows-specific file attributes to identify which OneDrive files are stored locally versus "cloud-only". It uses the Windows `attrib` command to:

1.  **Check file attributes** (the `P` and `U` flags indicate Pinned and Unpinned status)
2.  **Modify attributes** to make files cloud-only when requested

When you make a file "cloud-only", it remains accessible through Windows Explorer but doesn't take up local disk space. The file will be downloaded automatically when you open it.

## 🐛 Troubleshooting

-   **🚫 Permission errors**: Try running the application as administrator
-   **🔄 OneDrive sync issues**: Ensure OneDrive is properly set up with Files On-Demand enabled
-   **File showing as Cloud Only but is not:** Ensure the File is not opened in another process.
-   **No files showing**: Verify your OneDrive path is correctly configured in the app
-   **Changes not reflected**: OneDrive may take a moment to update file status after changes
-   **Configuration issues**: If the app doesn't start, check if `config.json` is corrupted or delete it to reset
-   **Path not saving**: Ensure the path exists and is accessible by the application

## 🛠️ Technical Details

-   **Backend**: Python Flask server
-   **Frontend**: HTML5, Tailwind CSS, and Alpine.js
-   **File Operations**: Windows command-line utilities (attrib)
-   **Data Analysis**: Python file system operations

## 📜 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgements

-   Icon designs by [Lucide](https://lucide.dev/)
-   UI components powered by [DaisyUI](https://daisyui.com/)