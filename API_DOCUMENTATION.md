# Clipper API Documentation

This document outlines the API endpoints for the Clipper application backend services.

## Services & Ports

To configure your Apache proxy, you need to route traffic to the following internal services:

| Service Name | Internal IP | Port | Description |
| :--- | :--- | :--- | :--- |
| **Node.js Main Backend** | `192.168.1.192` | `3002` | Main API and Frontend assets. |
| **Python Caption Service** | `192.168.1.192` | `8000` | Heavy AI tasks (Whisper/FFmpeg). |

### Apache Configuration

Here is the complete VirtualHost configuration for `clipper.drive.unwim.ac.id`:

```apache
<VirtualHost *:443>
    ServerName clipper.drive.unwim.ac.id
    ServerAdmin webmaster@localhost

    # SSL Configuration
    SSLEngine on
    Include /etc/letsencrypt/options-ssl-apache.conf
    SSLCertificateFile /etc/letsencrypt/live/clipper.drive.unwim.ac.id/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/clipper.drive.unwim.ac.id/privkey.pem

    # Proxy Configuration
    ProxyPreserveHost On
    ProxyRequests Off
    
    # 1. Main Node.js Backend (Port 3002) - Root Path
    ProxyPass / http://192.168.1.192:3002/
    ProxyPassReverse / http://192.168.1.192:3002/

    # 2. Python Caption Service (Port 8000)
    # Maps https://clipper.drive.unwim.ac.id/caption-service/ -> http://192.168.1.192:8000/
    <Location "/caption-service/">
        ProxyPass http://192.168.1.192:8000/
        ProxyPassReverse http://192.168.1.192:8000/
    </Location>

    # WebSocket Support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://192.168.1.192:3002/$1 [P,L]

    ErrorLog ${APACHE_LOG_DIR}/clipper-drive-error.log
    CustomLog ${APACHE_LOG_DIR}/clipper-drive-access.log combined
</VirtualHost>
```

---

## Node.js Main Backend

**Base URL:** `https://clipper.drive.unwim.ac.id` (via Proxy)

### Video Operations

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/video/download` | Start downloading a video | `{ url, projectId?, downloadSubtitles? }` |
| `POST` | `/video/download/:id/cancel` | Cancel a download job | `id` (path param) |
| `POST` | `/video/download/:id/retry` | Retry a failed download | `id` (path param) |
| `POST` | `/video/upload` | Upload a video file | (Multipart form data or JSON with path) |

### AI Features

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/ai/generate-metadata` | Generate title/desc/tags | `{ context }` |
| `POST` | `/ai/generate-summary` | Summarize transcript | `{ transcript }` |
| `POST` | `/ai/generate-script` | Generate script from summary | `{ summary, style? }` |
| `POST` | `/ai/generate-speech` | Text-to-Speech | `{ text, voice? }` |

### Auto Processing

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/auto/search` | Search for content to automate | `{ keyword, count, platform }` |
| `POST` | `/auto/run` | Start auto-creation job | `{ keyword, count, platform, projectId, selectedVideos }` |

### Channels

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/channels` | List tracked channels | - |
| `POST` | `/channels` | Add a channel | `{ name, platform, url, description? }` |
| `DELETE` | `/channels/:id` | Remove a channel | `id` (path param) |
| `GET` | `/channels/:id/videos` | Get videos from channel | `id` (path param), `?limit=10` |

### Editor & Rendering

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/editor/render` | Render a video project | `{ layers, clips, ... }` |

### Library Management

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/library/videos` | Get all library videos | - |
| `GET` | `/library/videos/:id` | Get single video details | `id` (path param) |
| `PUT` | `/library/videos/:id` | Update video metadata | `id` (path param), `{ ...updates }` |
| `DELETE` | `/library/videos/:id` | Delete a video | `id` (path param) |
| `POST` | `/library/videos/bulk-delete` | Delete multiple videos | `{ ids: string[] }` |
| `GET` | `/library/videos/:id/clips` | Get clips for a video | `id` (path param) |
| `DELETE` | `/library/clips/:id` | Delete a clip | `id` (path param) |
| `GET` | `/library/videos/:id/transcript` | Get primary transcript | `id` (path param) |
| `GET` | `/library/videos/:id/transcripts` | Get all transcripts | `id` (path param) |

### Magic Tools

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/magic/process` | Batch process videos | `{ url }` or `{ urls: [] }` |
| `GET` | `/magic/batch/:batchId` | Get batch status info | `batchId` (path param) |
| `GET` | `/magic/status/:jobId` | Get specific job status | `jobId` (path param) |

### Projects

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/projects` | List all projects | - |
| `GET` | `/projects/:id` | Get project details | `id` (path param) |
| `POST` | `/projects` | Create new project | `{ name, description? }` |
| `DELETE` | `/projects/:id` | Delete a project | `id` (path param) |
| `POST` | `/projects/:id/videos/add` | Add video to project | `id` (path param), `{ videoId }` |

### Research

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/research/trending` | Get trending videos | `?page=1&limit=6&source=youtube` |
| `POST` | `/research/search` | Search/Generate research | `{ query, page, limit, source }` |

### Settings

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/settings` | Get application settings | - |
| `POST` | `/settings` | Update settings | `{ ...settings }` |

### Webhooks

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/webhook/deploy` | Check webhook status | - |
| `POST` | `/webhook/deploy` | Trigger deployment | `?token=SECRET` |

---

## Python Caption Service

**Base URL:** `http://drive.unwim.ac.id:8000` (Remote) or `http://localhost:8000` (Local)

### Captioning

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/caption/start` | Start caption generation | Form Data: `file` (Upload) OR `video_id` (String) |
| `GET` | `/api/caption/{job_id}` | Check caption job status | `job_id` (path param) |

### Rendering

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/render-caption-video` | Render video with subtitles | `{ video_id, caption_json, style_template }` |
| `GET` | `/api/render-status/{job_id}` | Check render job status | `job_id` (path param) |

### Downloads

| Method | Endpoint | Description | Payload / Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/download/video/{filename}` | Download rendered video | `filename` (path param) |
| `GET` | `/api/download/subtitle/{filename}` | Download subtitle file | `filename` (path param) |
