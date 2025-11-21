#!/usr/bin/env python3
"""
Generate a JSON file listing all files in the current directory.
This allows the terminal to dynamically list actual files.
"""
import json
import os
from pathlib import Path

def generate_file_list():
    """Generate a JSON file with the list of files in the home subfolder."""
    files = []
    home_dir = Path('home')
    
    # Create home directory if it doesn't exist
    if not home_dir.exists():
        home_dir.mkdir()
        print("Created 'home' directory")
    
    # List all files in the home directory (excluding hidden files)
    for item in sorted(home_dir.iterdir()):
        if item.name.startswith('.'):
            continue  # Skip all hidden files/directories
            
        stat = item.stat()
        if item.is_file():
            size = stat.st_size
            files.append({
                'name': item.name,
                'type': 'file',
                'size': size
            })
        elif item.is_dir():
            files.append({
                'name': item.name,
                'type': 'directory',
                'size': 0
            })
    
    # Write to files.json
    with open('files.json', 'w') as f:
        json.dump({'files': files}, f, indent=2)
    
    print(f"Generated files.json with {len(files)} items from 'home' directory")

if __name__ == '__main__':
    generate_file_list()

