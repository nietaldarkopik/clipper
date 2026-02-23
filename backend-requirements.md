Backend Architecture Prompt: Video Clipper Pro (Automated AI Video Workflow)

Context

Build a robust Node.js backend to power an automated video clipping and social media publishing platform. The backend must handle high-compute video processing tasks and seamless API integrations.

## 1. System Architecture Diagram

```mermaid
graph TD
    UI[CREATOR UI (Electron/Web)\nReact + WS]
    API[BACKEND API (Node.js)\nAuth • Project • Clip\nUpload • Publish]
    Redis[REDIS / BULLMQ\nJob Queue]
    AI[AI WORKERS (Python)\nWhisper (STT)\nScene Detect\nEmotion/Audio Peak]
    Media[MEDIA ENGINE\nFFmpeg\nCrop/Resize/Burn]
    Storage[STORAGE\nS3 / MinIO / Local]
    Platform[PLATFORM API\nYouTube / TikTok\nIG / FB]

    UI -->|REST / WebSocket| API
    API -->|Job Queue| Redis
    Redis -->|video_analyze\nclip_generate\nsubtitle| AI
    AI --> Media
    Media --> Storage
    Storage --> Platform
    API --> Platform
```

Tech Stack Preferred

Language: TypeScript

Framework: Fastify (Preferred for performance) or Express.js

Database: PostgreSQL (for metadata/history) + Redis (for job queuing)

Processing Engine: FFmpeg (via fluent-ffmpeg)

AI Workers: Python (for Whisper, Scene Detect, OpenCV)

Task Queue: BullMQ (to handle long-running video downloads/renders)

Storage: AWS S3 or Google Cloud Storage (for raw and processed videos)

Core Modules to Implement

1. Research & Auto-Download Engine

Integration with YouTube Data API v3 and TikTok Scraper API.

Function to fetch "Trending" videos based on keywords.

Automated download logic using yt-dlp wrapper.

Logic to trigger "Auto-Download" for viral content.

2. AI Video Analyzer (Highlight Detection)

Integration with OpenAI (Whisper) for Speech-to-Text.

Logic to analyze transcript segments to identify high-engagement moments (using GPT-4o for semantic analysis).

Computer Vision integration (optional: OpenCV) to detect scene changes or high-action frames.

3. Video Processing Pipeline (The "Clipper")

Clip Engine: Function to extract segments using timestamps (FFmpeg).

Merge Engine: Function to concatenate multiple clips with transitions.

Overlay Engine: Logic to burn-in dynamic captions (ASS/SRT subtitle files generation) based on Whisper transcripts.

Style Engine: Apply CSS-like styling to FFmpeg filters for caption colors, effects, and positioning.

4. Metadata & Storage Management

Schema to store Clips, Projects, UploadHistory, and ProcessingQueue.

CRUD for Title, Description, Hashtags, and Meta Tags.

5. Social Media Integration (Auto-Post)

OAuth2 flow for YouTube, TikTok, and Instagram.

Automated upload multipart-form handling for video binaries.

Status callback (Webhook) to update the frontend when upload is successful.

6. Magic Link-to-Shorts (One-Click AI)

**Queue & Batch Management:**
*   **BullMQ Integration:**
    *   **Priority Queues:** "Magic" jobs get higher priority than standard bulk uploads.
    *   **Concurrency Control:** Limit active FFmpeg/AI jobs (e.g., max 2 concurrent renders) to prevent server overload.
*   **Batch Tracking:**
    *   Group multiple URL inputs into a single "Batch ID".
    *   **Progress UI:** Show granular status per video (e.g., "Video 1/5: Transcribing 40%", "Video 2/5: Queued").
    *   **Resumable:** If a job fails, allow retrying just that specific video without restarting the whole batch.

**Debug Console (Real-time Terminal):**
*   **Requirement:** A "Terminal-like" UI block that streams backend logs in real-time.

6. Magic Link-to-Shorts (One-Click Workflow)

**Input:** Single URL (YouTube, TikTok, or direct video link).

**Process (Automated Pipeline):**
1.  **Auto-Download:** Fetch video using `yt-dlp` (highest quality).
2.  **AI Analysis:** Transcribe (Whisper) + Detect Hooks (LLM) + Scene Detect.
3.  **Auto-Clip:** Extract best segments, crop to 9:16 (Vertical), and apply subtitles.
4.  **Auto-Publish (Optional):** Upload to connected platforms.

**Debug Console (Real-time Terminal):**
*   **Requirement:** A "Terminal-like" UI block that streams backend logs in real-time.
*   **Content:** Show stdout/stderr from `yt-dlp`, FFmpeg progress, Python worker logs, and error stacks.
*   **Feature:** Copy-paste support for easy debugging.
*   **Implementation:** WebSocket event streaming (`/ws/logs/:jobId`).

API Endpoints Required

**Existing (Research & Auto-Download):**
POST /research/search: Search viral content.

POST /video/download: Trigger background download job.

POST /video/analyze: Run AI highlight detection.

POST /editor/merge: Start background job for merging clips & adding captions.

GET /dashboard/status: Monitor active BullMQ jobs.

GET /history: Fetch upload logs.

**Additional (Creator Workflow & SaaS):**
*   **Auth:** `/auth/login`, `/auth/logout`, `/auth/me`
*   **Platforms:** `GET /platforms`, `POST /platforms/connect`, `DELETE /platforms/:id`
*   **Projects:** `POST /projects`, `GET /projects`, `GET /projects/:id`, `DELETE /projects/:id`
*   **Upload:** `POST /videos/upload` (Direct upload), `GET /videos/:id`
*   **Clips:** `POST /clips/generate`, `GET /clips?project_id=xxx`, `PATCH /clips/:id` (Edit)
*   **Publish:** `POST /publish` (Cross-platform)
*   **Analytics:** `GET /clips/:id/stats`
*   **Magic:** `POST /magic/process` (Input: URL or Array of URLs, Output: BatchID)
*   **Batch Status:** `GET /magic/batch/:batchId` (Progress of all jobs in batch)
*   **Logs:** `GET /magic/logs/:jobId` (WebSocket)
*   **Magic:** `POST /magic/process` (Input: URL, Output: JobID), `GET /magic/logs/:jobId` (WebSocket)

Security & Performance

Implement rate limiting for API scrapers.

Use horizontal scaling for worker threads handling FFmpeg tasks.

Ensure temporary file cleanup after processing/uploading.

Instructions for Implementation

Initialize the project with TypeScript and ESLint.

Set up BullMQ with Redis for background processing.

Start with the yt-dlp download service first.

Provide a robust error handling system for failed video renders.

## MVP 30-Day Roadmap

### WEEK 1 – FOUNDATION
*   [ ] Repo & Monorepo Setup
*   [ ] Auth System & Project Management
*   [ ] Upload Video Mechanism
*   [ ] Storage Integration (S3/MinIO)
*   [ ] FFmpeg Basic Trim
*   **🎯 Output:** Manual upload + manual trim.

### WEEK 2 – AI CORE
*   [ ] Whisper STT Integration
*   [ ] Audio Peak Detection & Scene Detection
*   [ ] Clip Candidate Scoring
*   **🎯 Output:** Auto-recommendation of clips.

### WEEK 3 – AUTO CLIP + EDITOR
*   [ ] Auto Vertical Crop (Landscape to Portrait)
*   [ ] Auto Subtitle Generation (Burn-in)
*   [ ] Light Editor (Trim + Text Overlay)
*   **🎯 Output:** Clips ready for upload.

### WEEK 4 – PUBLISH + POLISH
*   [ ] YouTube Shorts & TikTok Upload
*   [ ] Progress UI (WebSocket/Polling)
*   [ ] Error Handling & Retries
*   **🎯 Output:** End-to-end creator workflow.

## AI Prompt Strategy (Production Ready)

Use this for the LLM step after Whisper STT generates the transcript.

### System Prompt
```text
You are a professional video editor and viral content strategist.
Your job is to find the most engaging short-video moments.
```

### User Prompt
```text
Given this video transcript with timestamps, identify the most engaging moments
that would perform well as short-form content.

Criteria:
- Strong emotion (laughter, surprise, anger)
- Clear standalone context
- Maximum duration: 60 seconds
- Minimum duration: 15 seconds
- Avoid silence or filler words

Return JSON only.

Transcript:
{{TRANSCRIPT_WITH_TIMESTAMPS}}

EXPECTED OUTPUT:
[
  {
    "start": 312.4,
    "end": 352.8,
    "score": 0.92,
    "reason": "strong emotional reaction and clear punchline"
  }
]
```