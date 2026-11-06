"""The voice stacks and languages for the agent and the speech server, read from their folders by agent/common/voice.py
(docs/decisions/0012, 0022). COPILOT_AGENT_DIR points at the agent folder when it is not next to demo/ (the agent image)."""
import importlib.util, os

AGENT_DIR = os.environ.get('COPILOT_AGENT_DIR') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'agent')
# Loaded by path: the agent folder is not on this process's import path, and its package names (common) are too plain to add.
_spec = importlib.util.spec_from_file_location('copilot_voice', os.path.join(AGENT_DIR, 'common', 'voice.py'))
_voice = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_voice)
STACKS = _voice.load_voice(AGENT_DIR)
