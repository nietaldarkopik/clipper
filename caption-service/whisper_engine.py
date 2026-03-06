import os
from faster_whisper import WhisperModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WhisperEngine:
    def __init__(self, model_size="base", device="cpu", compute_type="int8"):
        logger.info(f"Loading Whisper model: {model_size} on {device} ({compute_type})")
        try:
            self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            # Fallback to CPU if GPU fails
            if device == "cuda":
                logger.warning("Falling back to CPU")
                self.model = WhisperModel(model_size, device="cpu", compute_type="int8")
            else:
                raise e

    def transcribe(self, audio_path):
        logger.info(f"Transcribing: {audio_path}")
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")
            
        segments, info = self.model.transcribe(audio_path, beam_size=5)
        
        result = []
        for segment in segments:
            result.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
            
        logger.info(f"Transcription complete. Found {len(result)} segments.")
        return result
