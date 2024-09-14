from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app) 

# make this directory the current directory
FILES_DIRECTORY = '.'  # Ensure this directory exists

@app.route('/get_files', methods=['GET'])
def get_files():
    try:
        files = os.listdir(FILES_DIRECTORY)
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
