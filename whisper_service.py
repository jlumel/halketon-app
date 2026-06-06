"""
Servicio Flask que expone Faster-Whisper en localhost:5001/transcribe
Inicio: python whisper_service.py
Requiere: pip install flask faster-whisper
"""

import os
import tempfile
from flask import Flask, request, jsonify
from faster_whisper import WhisperModel

app = Flask(__name__)

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

print(f"[whisper] Cargando modelo '{MODEL_SIZE}' en {DEVICE}/{COMPUTE_TYPE}...")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
print("[whisper] Modelo listo.")


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "Falta el campo 'audio'"}), 400

    audio_file = request.files["audio"]

    suffix = ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        audio_file.save(tmp_path)

    try:
        segments, info = model.transcribe(tmp_path, beam_size=5)
        transcription = " ".join(seg.text.strip() for seg in segments)
        return jsonify({
            "transcription": transcription,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_SIZE})


if __name__ == "__main__":
    port = int(os.environ.get("WHISPER_PORT", 5001))
    print(f"[whisper] Escuchando en http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
