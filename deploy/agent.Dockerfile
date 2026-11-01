# The voice call's agent (demo/live-site/speech/agent.py). It hears and speaks through the Pro's speech server
# (SPEECH_URL); it holds no speech models itself. See deploy/README.md.
FROM python:3.12-slim
WORKDIR /agent
COPY deploy/agent-requirements.txt .
RUN pip install --no-cache-dir -r agent-requirements.txt
COPY demo/live-site/speech/agent.py demo/live-site/speech/telemetry.py demo/live-site/speech/stacks.json ./
# Silero and the turn detectors' weights, baked into the image.
RUN python agent.py download-files
CMD ["python", "agent.py", "start"]
