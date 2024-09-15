from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from threading import Lock

import os

app = Flask(__name__)
CORS(app) 

FILES_DIRECTORY = '.'  # Ensure this directory exists
directory_lock = Lock()

@app.route('/get_directories', methods=['GET'])
def get_directories():
    path = request.args.get('path', FILES_DIRECTORY)
    try:
        directories = [d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d))]
        return jsonify({'directories': directories}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# add
@app.route('/change_directory', methods=['POST'])
def change_directory():
    new_path = request.json.get('path')
    if not new_path:
        return jsonify({'error': 'No path provided'}), 400

    if not os.path.isdir(new_path):
        return jsonify({'error': 'Directory does not exist'}), 404

    with directory_lock:
        FILES_DIRECTORY = new_path

    return jsonify({'message': 'Directory changed successfully'}), 200


@app.route('/get_files', methods=['GET'])
def get_files():
    try:
        path = request.args.get('path', FILES_DIRECTORY)
        files = os.listdir(path)

        # Filter out non-files if necessary
        files = [f for f in files if os.path.isfile(os.path.join(FILES_DIRECTORY, f))]
        return jsonify({'files': files}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/get_file_content', methods=['GET'])
def get_file_content():
    filename = request.args.get('filename')
    if not filename:
        return jsonify({'error': 'No filename provided'}), 400

    file_path = os.path.join(FILES_DIRECTORY, filename)

    if not os.path.isfile(file_path):
        return jsonify({'error': 'File does not exist'}), 404

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Ensure the files directory exists
    if not os.path.exists(FILES_DIRECTORY):
        os.makedirs(FILES_DIRECTORY)
    app.run(host='0.0.0.0', port=5000, debug=True)
