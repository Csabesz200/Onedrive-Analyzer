import os
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Default config
DEFAULT_CONFIG = {
    "onedrive_path": "",  # Empty by default, user must configure
    "default_max_depth": 2,
    "default_threads": True,
    "default_max_workers": 4
}

# Config file path
CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'config.json')

def load_config():
    """Load the configuration from the config file. If the file doesn't exist, create it with default values."""
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r') as f:
                config = json.load(f)
                logger.info(f"Configuration loaded from {CONFIG_FILE}")
                
                # Make sure all required fields are present
                for key in DEFAULT_CONFIG:
                    if key not in config:
                        config[key] = DEFAULT_CONFIG[key]
                        
                return config
        else:
            # Create the config file with default values
            with open(CONFIG_FILE, 'w') as f:
                json.dump(DEFAULT_CONFIG, f, indent=4)
            logger.info(f"Created default configuration at {CONFIG_FILE}")
            return DEFAULT_CONFIG.copy()
    except Exception as e:
        logger.error(f"Error loading configuration: {str(e)}")
        return DEFAULT_CONFIG.copy()

def save_config(config):
    """Save the configuration to the config file."""
    try:
        with open(CONFIG_FILE, 'w') as f:
            json.dump(config, f, indent=4)
        logger.info(f"Configuration saved to {CONFIG_FILE}")
        return True
    except Exception as e:
        logger.error(f"Error saving configuration: {str(e)}")
        return False

def update_onedrive_path(new_path):
    """Update the OneDrive path in the configuration."""
    config = load_config()
    config["onedrive_path"] = new_path
    return save_config(config)

def get_onedrive_path():
    """Get the OneDrive path from the configuration."""
    config = load_config()
    return config.get("onedrive_path", "")
