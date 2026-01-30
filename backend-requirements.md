Backend Architecture Prompt: Video Clipper Pro (Automated AI Video Workflow)

Context

Build a robust Node.js backend to power an automated video clipping and social media publishing platform. The backend must handle high-compute video processing tasks and seamless API integrations.

Tech Stack Preferred

Language: TypeScript

Framework: Fastify (Preferred for performance) or Express.js

Database: PostgreSQL (for metadata/history) + Redis (for job queuing)

Processing Engine: FFmpeg (via fluent-ffmpeg)

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

API Endpoints Required

POST /research/search: Search viral content.

POST /video/download: Trigger background download job.

POST /video/analyze: Run AI highlight detection.

POST /editor/merge: Start background job for merging clips & adding captions.

GET /dashboard/status: Monitor active BullMQ jobs.

GET /history: Fetch upload logs.

Security & Performance

Implement rate limiting for API scrapers.

Use horizontal scaling for worker threads handling FFmpeg tasks.

Ensure temporary file cleanup after processing/uploading.

Instructions for Implementation

Initialize the project with TypeScript and ESLint.

Set up BullMQ with Redis for background processing.

Start with the yt-dlp download service first.

Provide a robust error handling system for failed video renders.