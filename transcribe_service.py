from flask import Flask, request, jsonify
from faster_whisper import WhisperModel
import tempfile, os

app = Flask(__name__)
model = WhisperModel('base', device='cpu', compute_type='int8')

@app.route('/transcribe', methods=['POST'])
def transcribe():
    audio = request.files['audio']
    with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f:
        audio.save(f.name)
        segments, _ = model.transcribe(f.name, beam_size=5, language='es')
        text = ' '.join([s.text for s in segments])
        os.unlink(f.name)
    return jsonify({'transcription': text})

if __name__ == '__main__':
    app.run(port=5001)