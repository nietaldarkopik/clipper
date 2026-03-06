import json
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

def format_timestamp(seconds, fmt="srt"):
    td = timedelta(seconds=seconds)
    hours, remainder = divmod(td.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    milliseconds = td.microseconds // 1000
    
    if fmt == "srt":
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"
    elif fmt == "vtt":
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"
    elif fmt == "ass":
        # H:MM:SS.cs (centiseconds)
        return f"{hours:1d}:{minutes:02d}:{seconds:02d}.{milliseconds // 10:02d}"
    return str(td)

class SubtitleGenerator:
    def __init__(self, segments):
        self.segments = segments

    def to_srt(self):
        output = []
        for i, segment in enumerate(self.segments):
            start = format_timestamp(segment["start"], "srt")
            end = format_timestamp(segment["end"], "srt")
            text = segment["text"]
            output.append(f"{i+1}\n{start} --> {end}\n{text}\n")
        return "\n".join(output)

    def to_vtt(self):
        output = ["WEBVTT\n"]
        for i, segment in enumerate(self.segments):
            start = format_timestamp(segment["start"], "vtt")
            end = format_timestamp(segment["end"], "vtt")
            text = segment["text"]
            output.append(f"{start} --> {end}\n{text}\n")
        return "\n".join(output)

    def to_json(self):
        return json.dumps(self.segments, indent=2)

    def _convert_color(self, hex_color):
        if not hex_color:
            return "&H00FFFFFF"
        hex_color = hex_color.lstrip('#')
        if len(hex_color) == 6:
            r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
            return f"&H00{b}{g}{r}".upper()
        return "&H00FFFFFF"

    def to_ass(self, style_options=None):
        if style_options is None:
            style_options = {}

        font_name = style_options.get("font", "Arial")
        font_size = style_options.get("size", 24)
        primary_color = self._convert_color(style_options.get("color", "#FFFFFF"))
        outline_color = self._convert_color(style_options.get("stroke", "#000000"))
        back_color = "&H00000000"
        bold = -1 if style_options.get("bold", False) else 0
        italic = -1 if style_options.get("italic", False) else 0
        alignment = 2 # Bottom Center by default
        
        position = style_options.get("position", "bottom")
        if position == "top":
            alignment = 8
        elif position == "middle":
            alignment = 5

        # BorderStyle: 1=Outline + Drop shadow, 3=Opaque box
        border_style = 1
        if style_options.get("background", False):
            border_style = 3

        header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_color},&H000000FF,{outline_color},{back_color},{bold},{italic},0,0,100,100,0,0,{border_style},2,0,{alignment},10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
""".format(
            font_name=font_name,
            font_size=font_size,
            primary_color=primary_color,
            outline_color=outline_color,
            back_color=back_color,
            bold=bold,
            italic=italic,
            border_style=border_style,
            alignment=alignment
        )

        events = []
        for segment in self.segments:
            start = format_timestamp(segment["start"], "ass")
            end = format_timestamp(segment["end"], "ass")
            text = segment["text"].replace("\n", "\\N")
            events.append(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}")
        
        return header + "\n".join(events)

    def save(self, filepath, format="srt", style_options=None):
        content = ""
        if format == "srt":
            content = self.to_srt()
        elif format == "vtt":
            content = self.to_vtt()
        elif format == "json":
            content = self.to_json()
        elif format == "ass":
            content = self.to_ass(style_options)
        else:
            raise ValueError(f"Unsupported format: {format}")
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        logger.info(f"Subtitle saved to {filepath} in {format} format.")
