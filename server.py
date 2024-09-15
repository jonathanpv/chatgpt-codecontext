from flask import Flask, jsonify, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)

# Define the base directory
BASE_DIRECTORY = '/Users/teto/coding/InternHelper/electron-app'  # Ensure this directory exists

# List of directories to monitor relative to BASE_DIRECTORY
MONITORED_DIRECTORIES = [
    'src/renderer/src',
    'components/ui',
    # Add more directories here as needed, e.g., 'utils', 'assets', etc.
]

# Compute the full paths for each monitored directory
FILES_DIRECTORIES = [os.path.join(BASE_DIRECTORY, directory) for directory in MONITORED_DIRECTORIES]

@app.route('/get_files', methods=['GET'])
def get_files():
    """
    Retrieves all files from the specified monitored directories.
    Returns a JSON object with directory names as keys and lists of files as values.
    """
    all_files = {}
    try:
        for directory, dir_path in zip(MONITORED_DIRECTORIES, FILES_DIRECTORIES):
            if os.path.exists(dir_path) and os.path.isdir(dir_path):
                # List all files in the directory
                files = os.listdir(dir_path)
                # Filter out non-files (e.g., directories)
                files = [f for f in files if os.path.isfile(os.path.join(dir_path, f))]
                all_files[directory] = files
            else:
                # If the directory doesn't exist, return an empty list
                all_files[directory] = []
        return jsonify({'files': all_files}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_file_content', methods=['GET'])
def get_file_content():
    """
    Retrieves the content of a specified file from a specified directory.
    Expects 'filename' and 'directory' as query parameters.
    """
    filename = request.args.get('filename')
    directory = request.args.get('directory')

    # Validate input parameters
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400
    if not directory:
        return jsonify({'error': 'No directory provided'}), 400
    if directory not in MONITORED_DIRECTORIES:
        return jsonify({'error': 'Invalid directory specified'}), 400

    # Construct the full file path
    dir_path = os.path.join(BASE_DIRECTORY, directory)
    file_path = os.path.join(dir_path, filename)

    # Check if the file exists
    if not os.path.isfile(file_path):
        return jsonify({'error': 'File does not exist'}), 404

    try:
        # Read and return the file content
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def ensure_directories():
    """
    Ensures that the base directory and all monitored directories exist.
    Creates them if they do not.
    """
    if not os.path.exists(BASE_DIRECTORY):
        os.makedirs(BASE_DIRECTORY)
        print(f"Created base directory: {BASE_DIRECTORY}")
    
    for dir_path in FILES_DIRECTORIES:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
            print(f"Created monitored directory: {dir_path}")

if __name__ == '__main__':
    # Ensure all necessary directories exist before starting the server
    ensure_directories()
    app.run(host='0.0.0.0', port=5000, debug=True)
