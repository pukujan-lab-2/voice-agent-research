"""Runs on the Windows GPU machine: read a PDF with PaddleOCR-VL-1.6 and write one Markdown file per page.
Usage (in the paddleocr-vl venv): python paddle_read.py <file.pdf> <out_dir>
"""
import os, sys
from paddleocr import PaddleOCRVL

pdf, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
pipeline = PaddleOCRVL(pipeline_version="v1.6")
for i, res in enumerate(pipeline.predict(pdf)):
    md = res.markdown
    text = md.get("markdown_texts", "") if isinstance(md, dict) else str(md)
    open(os.path.join(out, f"page{i + 1:03d}.md"), "w", encoding="utf-8").write(text)
    print("page", i + 1, len(text), "chars", flush=True)
