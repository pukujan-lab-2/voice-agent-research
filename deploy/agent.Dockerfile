# The voice call's agent (demo/live-site/speech/agent.py). It hears and speaks through the Pro's speech server
# (SPEECH_URL); it holds no speech models itself. See deploy/README.md.
FROM python:3.12-slim
WORKDIR /agent
COPY deploy/agent-requirements.txt .
RUN pip install --no-cache-dir -r agent-requirements.txt
COPY demo/live-site/speech/agent.py demo/live-site/speech/telemetry.py demo/live-site/speech/stall_watchdog.py demo/live-site/speech/recording.py demo/live-site/speech/speech_errors.py demo/live-site/speech/voice_config.py ./
# The voice stacks and languages (agent/voice, agent/languages) and the file that reads them (docs/decisions/0022).
COPY agent/common/voice.py copilot-agent/common/
COPY agent/voice copilot-agent/voice
COPY agent/languages copilot-agent/languages
ENV COPILOT_AGENT_DIR=/agent/copilot-agent
# Silero and the turn detectors' weights, baked into the image.
RUN python agent.py download-files
CMD ["python", "agent.py", "start"]
