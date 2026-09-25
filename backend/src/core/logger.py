import sys
from loguru import logger

__all__ = ["logger"]

def setup_logger() -> None:
    """Configures the central logger for the Vector DB project."""
    # Remove the default standard output logger
    logger.remove()
    
    # Add a new logger that outputs structured JSON
    # We serialize=True to make it JSON, and set the minimum level to INFO
    logger.add(
        sys.stdout, 
        serialize=True, 
        level="INFO",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} - {message}"
    )

# Run the setup immediately when this module is imported
setup_logger()