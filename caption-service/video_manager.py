import os
import shutil
import uuid
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class VideoManager:
    def __init__(self, data_dir=None):
        if data_dir is None:
            # Default to current directory if not provided
            data_dir = os.path.join(os.getcwd(), "data")
        
        self.data_dir = data_dir
        self.upload_dir = os.path.join(data_dir, "uploads")
        self.audio_dir = os.path.join(data_dir, "audio")
        self.subtitle_dir = os.path.join(data_dir, "subtitles")
        self.output_dir = os.path.join(data_dir, "output")

        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(self.audio_dir, exist_ok=True)
        os.makedirs(self.subtitle_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)

    def save_upload(self, file_object, filename):
        ext = os.path.splitext(filename)[1]
        video_id = str(uuid.uuid4())
        unique_name = f"{video_id}{ext}"
        path = os.path.join(self.upload_dir, unique_name)
        
        with open(path, "wb") as f:
            shutil.copyfileobj(file_object, f)
            
        logger.info(f"Video saved: {path} (ID: {video_id})")
        return path, video_id

    def get_video_path(self, video_id):
        # We need to find the file with the correct extension
        # This is a bit tricky if we don't store the extension
        # For simplicity, let's assume we can search or pass the full name.
        # Or just store a map.
        # But wait, save_upload returns video_id. We should probably return video_id and extension, or full filename.
        # Let's search for the file in upload_dir starting with video_id
        for file in os.listdir(self.upload_dir):
            if file.startswith(video_id):
                return os.path.join(self.upload_dir, file)
        return None

    def get_audio_path(self, video_id):
        return os.path.join(self.audio_dir, f"{video_id}.wav")

    def get_subtitle_path(self, video_id, fmt="srt"):
        return os.path.join(self.subtitle_dir, f"{video_id}.{fmt}")

    def get_output_path(self, video_id, filename="output.mp4"):
        return os.path.join(self.output_dir, filename)

    def extract_audio(self, video_path, video_id):
        audio_path = self.get_audio_path(video_id)
        # Use ffmpeg to extract audio
        # ffmpeg -i input.mp4 -ar 16000 -ac 1 audio.wav
        import ffmpeg
        try:
            logger.info(f"Extracting audio from {video_path} to {audio_path}")
            stream = ffmpeg.input(video_path)
            stream = ffmpeg.output(stream, audio_path, ar=16000, ac=1)
            ffmpeg.run(stream, overwrite_output=True, quiet=True)
            return audio_path
        except ffmpeg.Error as e:
            logger.error(f"Failed to extract audio: {e.stderr.decode('utf8')}")
            raise RuntimeError("Audio extraction failed")

