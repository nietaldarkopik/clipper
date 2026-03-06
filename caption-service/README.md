# Clipper Caption Service

This is the backend service for the Auto Caption feature.

## Requirements

- Python 3.8+
- FFmpeg (installed and added to system PATH)
- CUDA (optional, for GPU acceleration)

## Installation

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Install FFmpeg:
   - **Linux**: `sudo apt install ffmpeg`
   - **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add `bin` folder to PATH.

## Running the Service

Start the FastAPI server:

```bash
python main.py
```

The service will run on `http://0.0.0.0:8000`.

## API Documentation

Once running, visit `http://localhost:8000/docs` for the interactive API documentation.

## Directory Structure

- `uploads/`: Stores uploaded videos.
- `audio/`: Stores extracted audio files.
- `subtitles/`: Stores generated subtitle files (SRT, VTT, JSON, ASS).
- `output/`: Stores the final rendered videos.

## Integration with Electron

The Electron app expects this service to be running at `http://localhost:8000` (or configured URL).
Ensure the `caption-service` is running before using the "Auto Caption" feature in the editor.
