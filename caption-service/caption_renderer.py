import ffmpeg
import os
import logging
import platform

logger = logging.getLogger(__name__)

class CaptionRenderer:
    def __init__(self, output_dir):
        self.output_dir = output_dir
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

    def _escape_path(self, path):
        # Convert backslashes to forward slashes
        path = path.replace('\\', '/')
        # Escape colons (e.g. C:/path -> C\:/path)
        path = path.replace(':', '\\:')
        # Escape single quotes
        path = path.replace("'", "\\'")
        return path

    def render_video(self, video_path, subtitle_path, output_filename):
        """
        Render video with subtitles.
        """
        output_path = os.path.join(self.output_dir, output_filename)
        logger.info(f"Rendering video: {video_path} with subtitles: {subtitle_path} to {output_path}")

        try:
            stream = ffmpeg.input(video_path)
            
            # Check subtitle format
            if subtitle_path.endswith('.ass'):
                # For ASS, use ass filter
                # Note: ffmpeg-python might not handle filter argument escaping perfectly for complex paths
                # We try to pass filename directly.
                # However, for complex filters, sometimes it's better to construct the filter string.
                # stream.filter('ass', filename)
                
                # We need to escape the path for the filter string
                escaped_sub_path = self._escape_path(subtitle_path)
                stream = stream.filter('ass', escaped_sub_path)
            else:
                # For SRT/VTT, use subtitles filter
                escaped_sub_path = self._escape_path(subtitle_path)
                stream = stream.filter('subtitles', escaped_sub_path)

            # Use libx264 for video, copy audio if possible (but if we filter video, we must re-encode video)
            # Audio usually can be copied unless we edit it, but let's re-encode aac to be safe
            stream = ffmpeg.output(stream, output_path, vcodec='libx264', acodec='aac')
            
            # capture_stdout=True, capture_stderr=True allows us to see error output in exception
            ffmpeg.run(stream, overwrite_output=True, capture_stdout=True, capture_stderr=True)
            
            logger.info(f"Rendering complete: {output_path}")
            return output_path
        except ffmpeg.Error as e:
            error_message = e.stderr.decode('utf8') if e.stderr else "Unknown FFmpeg error"
            logger.error(f"FFmpeg error: {error_message}")
            raise RuntimeError(f"FFmpeg rendering failed: {error_message}")
