from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import threading

app = Flask(__name__)
CORS(app)

INITIAL_BASE_DIRECTORY = '/Users/teto/coding/InternHelper/electron-app'
BASE_DIRECTORY = INITIAL_BASE_DIRECTORY
BASE_DIRECTORY_LOCK = threading.Lock()

# Define the set of common code file extensions
CODE_EXTENSIONS = {
    '.py', '.js', '.cpp', '.java', '.jsx', '.ts', '.tsx',
    '.c', '.cs', '.rb', '.go', '.php', '.swift', '.kt'
}

def get_base_directory():
    with BASE_DIRECTORY_LOCK:
        return BASE_DIRECTORY

def set_base_directory(new_path):
    global BASE_DIRECTORY
    with BASE_DIRECTORY_LOCK:
        BASE_DIRECTORY = new_path

IGNORED_DIRECTORIES = {
    'node_modules', '__pycache__', '.git', '.svn',
    '.venv', 'dist', 'build', 'vendor', 'tmp', 'out', 'venv', '.cursor', 'cursor', '.local', '.bun', 'Library', 'Application Support', 'VisualStudio', 'Application', 'Movies', 'Document', '.next', 'next', '.vscode-insiders'
}

def resolve_path(relative_path):
    base_dir = get_base_directory()
    if os.path.isabs(relative_path):
        return os.path.normpath(relative_path)
    else:
        return os.path.normpath(os.path.join(base_dir, relative_path))

@app.route('/get_current_directory', methods=['GET'])
def get_current_directory():
    current_dir = get_base_directory()
    return jsonify({'current_directory': current_dir}), 200

@app.route('/set_base_directory', methods=['POST'])
def set_base_directory_endpoint():
    data = request.get_json()
    if not data or 'new_directory' not in data:
        return jsonify({'error': "Missing 'new_directory' in request body"}), 400

    new_directory = data['new_directory']
    abs_new_directory = resolve_path(new_directory)

    if not os.path.exists(abs_new_directory):
        return jsonify({'error': 'New base directory does not exist'}), 400
    if not os.path.isdir(abs_new_directory):
        return jsonify({'error': 'New base directory is not a directory'}), 400

    set_base_directory(abs_new_directory)
    print(f"Base directory set to: {abs_new_directory}")

    # Update ALL_FILES synchronously
    try:
        files = retrieve_all_files_recursive()
        with ALL_FILES_LOCK:
            ALL_FILES.clear()
            ALL_FILES.extend(files)
        print(f"ALL_FILES updated with {len(files)} files after changing directory.")
    except Exception as e:
        print(f"Error updating ALL_FILES after changing directory: {e}")
        return jsonify({'error': str(e)}), 500

    return jsonify({
        'message': 'Base directory updated successfully',
        'current_directory': abs_new_directory
    }), 200

@app.route('/get_dropdown_suggestions', methods=['GET'])
def get_dropdown_suggestions():
    current_path = request.args.get('current_path', '.')
    abs_current_path = resolve_path(current_path)

    if not os.path.exists(abs_current_path):
        return jsonify({'error': 'Current path does not exist'}), 404
    if not os.path.isdir(abs_current_path):
        return jsonify({'error': 'Current path is not a directory'}), 400

    try:
        items = os.listdir(abs_current_path)
        directories = [
            item for item in items
            if os.path.isdir(os.path.join(abs_current_path, item)) and item not in IGNORED_DIRECTORIES
        ]
        suggestions = ['..'] + directories
        return jsonify({'suggestions': suggestions}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/search_files', methods=['GET'])
def search_files():
    query = request.args.get('query', '').strip().lower()
    print(f"Received /search_files request with query: '{query}'")

    if not query:
        print("No query provided in /search_files request.")
        return jsonify({'error': 'No query provided'}), 400

    try:
        with ALL_FILES_LOCK:
            matching_files = [
                file for file in ALL_FILES
                if os.path.basename(file).lower().startswith(query)
            ]
        print(f"Found {len(matching_files)} matching files for query '{query}'.")
    except Exception as e:
        print(f"Exception in /search_files: {e}")
        return jsonify({'error': str(e)}), 500

    return jsonify({'results': matching_files}), 200

@app.route('/get_file_content', methods=['GET'])
def get_file_content():
    filename = request.args.get('filename')
    relative_path = request.args.get('path', '.')  # Default to BASE_DIRECTORY
    print(f"Received /get_file_content request with filename: {filename}, path: {relative_path}")

    if not filename:
        print("No filename provided in /get_file_content request.")
        return jsonify({'error': 'No filename provided'}), 400

    try:
        abs_dir_path = resolve_path(relative_path)
        print(f"Resolved absolute directory path: {abs_dir_path}")
    except ValueError as ve:
        print(f"ValueError in /get_file_content: {ve}")
        return jsonify({'error': str(ve)}), 400

    if not os.path.exists(abs_dir_path):
        print(f"Path does not exist: {abs_dir_path}")
        return jsonify({'error': 'Path does not exist'}), 404
    if not os.path.isdir(abs_dir_path):
        print(f"Path is not a directory: {abs_dir_path}")
        return jsonify({'error': 'Path is not a directory'}), 400

    file_path = os.path.join(abs_dir_path, filename)
    print(f"Constructed file path: {file_path}")

    if not os.path.isfile(file_path):
        print(f"File does not exist: {file_path}")
        return jsonify({'error': 'File does not exist'}), 404

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        print(f"Read content from {file_path}")
        return jsonify({'content': content}), 200
    except Exception as e:
        print(f"Exception in /get_file_content: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_all_files_recursive', methods=['GET'])
def get_all_files_recursive_endpoint():
    try:
        with ALL_FILES_LOCK:
            all_files_copy = list(ALL_FILES)
        print(f"Retrieved ALL_FILES copy with {len(all_files_copy)} files.")
        return jsonify({'all_files': all_files_copy}), 200
    except Exception as e:
        print(f"Exception in /get_all_files_recursive: {e}")
        return jsonify({'error': str(e)}), 500

# Global variables for caching
ALL_FILES = []
ALL_FILES_LOCK = threading.Lock()

def retrieve_all_files_recursive():
    all_files = []
    print("Starting recursive file retrieval.")
    for root, dirs, files in os.walk(BASE_DIRECTORY, followlinks=False):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRECTORIES]
        for file in files:
            _, ext = os.path.splitext(file)
            if ext.lower() in CODE_EXTENSIONS:
                rel_dir = os.path.relpath(root, BASE_DIRECTORY)
                rel_path = os.path.join(rel_dir, file) if rel_dir != '.' else file
                all_files.append(rel_path)
                print(f"Added file to ALL_FILES: {rel_path}")
    print(f"Total files retrieved: {len(all_files)}")
    return all_files

def initialize_all_files():
    global ALL_FILES
    try:
        files = retrieve_all_files_recursive()
        with ALL_FILES_LOCK:
            ALL_FILES.extend(files)
        print(f"Initialized ALL_FILES with {len(files)} files.")
    except Exception as e:
        print(f"Error initializing ALL_FILES: {e}")

if __name__ == '__main__':
    # Initialize ALL_FILES cache
    initialize_all_files()

    try:
        app.run(host='0.0.0.0', port=5001, debug=True)
    except OSError:
        print("❌ Failed to start the server. Port 5001 might be in use. Please free the port or change to a different one.")
