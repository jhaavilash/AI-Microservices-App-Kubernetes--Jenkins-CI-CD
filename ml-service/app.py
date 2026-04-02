from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/health')
def health():
    return "OK"

@app.route('/predict', methods=['POST'])
def predict():
    text = request.json['text']
    sentiment = "positive" if "good" in text else "negative"
    return jsonify({"sentiment": sentiment})

app.run(host='0.0.0.0', port=5000)