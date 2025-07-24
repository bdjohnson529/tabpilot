from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)  # Allow all origins (or lock down to your extension ID if needed)

OLLAMA_URL = "http://localhost:11434/api/generate"

@app.route("/api/generate", methods=["POST"])
def generate():
    try:
        ollama_response = requests.post(OLLAMA_URL, json=request.get_json())
        return jsonify(ollama_response.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(port=5001)