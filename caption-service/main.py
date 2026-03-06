from fastapi import FastAPI, UploadFile, File, BackgroundTasks, HTTPException, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
import os
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Import our modules
from video_manager import VideoManager
from whisper_engine import WhisperEngine
from subtitle_generator import SubtitleGenerator
from caption_renderer import CaptionRenderer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("CaptionService")

app = FastAPI(title="Clipper Caption Service")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
# Use /data/clipper as base dir if available, otherwise ./data
BASE_DIR = os.getenv("CLIPPER_DATA_DIR", os.path.join(os.getcwd(), "data"))
video_manager = VideoManager(data_dir=BASE_DIR)

# Initialize Whisper model lazily or on startup
# We'll use a global variable
whisper_engine = None

def get_whisper_engine():
    global whisper_engine
    if whisper_engine is None:
        # Load model (this might take time)
        whisper_engine = WhisperEngine(model_size="base") # "base" for speed, "medium"/"large" for accuracy
    return whisper_engine

caption_renderer = CaptionRenderer(output_dir=video_manager.output_dir)

# In-memory job store (replace with Redis in production)
jobs = {}

class JobStatus:
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class CaptionRequest(BaseModel):
    video_id: str

class StyleOptions(BaseModel):
    font: str = "Arial"
    size: int = 24
    color: str = "#FFFFFF"
    stroke: str = "#000000"
    position: str = "bottom"
    background: bool = False
    bold: bool = False
    italic: bool = False

class RenderRequest(BaseModel):
    video_id: str
    caption_json: List[Dict[str, Any]]
    style_template: StyleOptions

# Background tasks
def process_caption_job(job_id: str, video_id: str, video_path: str):
    try:
        jobs[job_id]["status"] = JobStatus.PROCESSING
        
        # 1. Extract Audio
        audio_path = video_manager.extract_audio(video_path, video_id)
        
        # 2. Transcribe
        engine = get_whisper_engine()
        segments = engine.transcribe(audio_path)
        
        # 3. Save default subtitles
        generator = SubtitleGenerator(segments)
        srt_path = video_manager.get_subtitle_path(video_id, "srt")
        vtt_path = video_manager.get_subtitle_path(video_id, "vtt")
        json_path = video_manager.get_subtitle_path(video_id, "json")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(srt_path), exist_ok=True)
        
        generator.save(srt_path, "srt")
        generator.save(vtt_path, "vtt")
        generator.save(json_path, "json")
        
        jobs[job_id]["status"] = JobStatus.COMPLETED
        jobs[job_id]["result"] = {
            "segments": segments,
            "srt_url": f"/api/download/subtitle/{video_id}.srt",
            "vtt_url": f"/api/download/subtitle/{video_id}.vtt",
            "json_url": f"/api/download/subtitle/{video_id}.json"
        }
        
    except Exception as e:
        logger.error(f"Job {job_id} failed: {e}")
        jobs[job_id]["status"] = JobStatus.FAILED
        jobs[job_id]["error"] = str(e)

def process_render_job(job_id: str, video_id: str, segments: List[Dict], style_options: Dict):
    try:
        jobs[job_id]["status"] = JobStatus.PROCESSING
        
        video_path = video_manager.get_video_path(video_id)
        if not video_path:
            raise FileNotFoundError(f"Video {video_id} not found")

        # 1. Generate Subtitle File (ASS for styling)
        generator = SubtitleGenerator(segments)
        # Use a unique name for this render job's subtitle
        sub_filename = f"{job_id}.ass"
        sub_path = os.path.join(video_manager.subtitle_dir, sub_filename)
        
        # Convert style_options Pydantic model to dict if needed, or use as is
        # If it's a dict (from request.dict()), good.
        generator.save(sub_path, "ass", style_options=style_options)
        
        # 2. Render Video
        output_filename = f"captioned_{job_id}.mp4"
        output_path = caption_renderer.render_video(video_path, sub_path, output_filename)
        
        jobs[job_id]["status"] = JobStatus.COMPLETED
        jobs[job_id]["result"] = {
            "video_url": f"/api/download/video/{output_filename}",
            "filename": output_filename
        }
        
    except Exception as e:
        logger.error(f"Render job {job_id} failed: {e}")
        jobs[job_id]["status"] = JobStatus.FAILED
        jobs[job_id]["error"] = str(e)


# API Endpoints

@app.post("/api/caption/start")
async def start_caption(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(None),
    video_id: str = Form(None)
):
    """
    Start a caption generation job.
    Accepts either a file upload OR a video_id (if already uploaded).
    """
    if file:
        # Save file
        # We need to save it to a temp file first because UploadFile.file is a SpooledTemporaryFile
        # But video_manager expects a file-like object, which it is.
        # However, to be safe with async, we can read it.
        # But video_manager uses shutil.copyfileobj which works with file-like.
        # Let's try passing file.file directly.
        file_path, new_video_id = video_manager.save_upload(file.file, file.filename)
        current_video_id = new_video_id
    elif video_id:
        current_video_id = video_id
        file_path = video_manager.get_video_path(video_id)
        if not file_path:
            raise HTTPException(status_code=404, detail="Video not found")
    else:
        raise HTTPException(status_code=400, detail="Either file or video_id must be provided")

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "id": job_id,
        "type": "caption",
        "video_id": current_video_id,
        "status": JobStatus.PENDING
    }
    
    background_tasks.add_task(process_caption_job, job_id, current_video_id, file_path)
    
    return {"job_id": job_id, "video_id": current_video_id, "status": "pending"}

@app.get("/api/caption/{job_id}")
async def get_caption_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.post("/api/render-caption-video")
async def render_caption_video(
    request: RenderRequest,
    background_tasks: BackgroundTasks
):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "id": job_id,
        "type": "render",
        "video_id": request.video_id,
        "status": JobStatus.PENDING
    }
    
    background_tasks.add_task(
        process_render_job, 
        job_id, 
        request.video_id, 
        request.caption_json, 
        request.style_template.dict()
    )
    
    return {"job_id": job_id, "status": "pending"}

@app.get("/api/render-status/{job_id}")
async def get_render_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.get("/api/download/video/{filename}")
async def download_video(filename: str):
    file_path = os.path.join(video_manager.output_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, media_type="video/mp4", filename=filename)

@app.get("/api/download/subtitle/{filename}")
async def download_subtitle(filename: str):
    # Filename should be video_id.srt/vtt/json
    file_path = os.path.join(video_manager.subtitle_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=filename)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
