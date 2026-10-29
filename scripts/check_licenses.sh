#!/usr/bin/env bash
# Re-check declared licenses (Hugging Face) and repo health (GitHub) for the models
# and projects in docs/. Requires curl, python3 and an authenticated `gh` CLI.
set -euo pipefail

HF_MODELS=(
  openai/whisper-large-v3 openai/whisper-large-v3-turbo Systran/faster-whisper-large-v3
  distil-whisper/distil-large-v3.5 nvidia/parakeet-tdt-0.6b-v3 nvidia/canary-1b-v2
  mistralai/Voxtral-Mini-3B-2507 kyutai/stt-2.6b-en ibm-granite/granite-speech-3.3-8b
  k2-fsa/OmniVoice hexgrad/Kokoro-82M coqui/XTTS-v2 ResembleAI/chatterbox sesame/csm-1b
  nari-labs/Dia-1.6B kyutai/tts-1.6b-en_fr neuphonic/neutts-air microsoft/VibeVoice-1.5B
  SWivid/F5-TTS fishaudio/s1-mini myshell-ai/MeloTTS-English canopylabs/orpheus-3b-0.1-ft
  IndexTeam/IndexTTS-2
  facebook/nllb-200-distilled-600M facebook/m2m100_418M facebook/m2m100_1.2B
  google/madlad400-3b-mt Helsinki-NLP/opus-mt-en-es facebook/seamless-m4t-v2-large
  utter-project/EuroLLM-9B-Instruct
  pyannote/speaker-diarization-3.1 pyannote/speaker-diarization-community-1
  pyannote/segmentation-3.0 nvidia/diar_sortformer_4spk-v1 nvidia/diar_streaming_sortformer_4spk-v2
  Qwen/Qwen3-4B-Instruct-2507 openai/gpt-oss-20b mistralai/Mistral-Small-3.2-24B-Instruct-2506
  LiquidAI/LFM3-Omni-2B
)

GH_REPOS=(
  chatwoot/chatwoot langflow-ai/langflow livekit/agents livekit/livekit livekit/sip
  pipecat-ai/pipecat langgenius/dify FlowiseAI/Flowise n8n-io/n8n baptisteArno/typebot.io
  TEN-framework/ten-framework botpress/botpress RasaHQ/rasa jambonz/jambonz-feature-server
  cjpais/Handy OpenWhispr/openwhispr Beingpax/VoiceInk ggml-org/whisper.cpp
  SYSTRAN/faster-whisper k2-fsa/sherpa-onnx k2-fsa/OmniVoice
)

HF_PARSE=$(cat <<'PY'
import sys, json
name = sys.argv[1]
try:
    d = json.load(sys.stdin)
except Exception:
    print(name + "\tFETCH_ERROR"); sys.exit()
if "error" in d:
    print(name + "\tERROR: " + str(d["error"])); sys.exit()
cd = d.get("cardData") or {}
lic = cd.get("license") or ",".join(t[8:] for t in d.get("tags", []) if t.startswith("license:")) or "none"
if cd.get("license_name"):
    lic = "%s (%s)" % (lic, cd["license_name"])
print("\t".join([name, str(lic), str(d.get("gated")), d.get("lastModified", "")[:10]]))
PY
)

echo "## Hugging Face declared licenses"
printf 'model\tlicense\tgated\tlast_modified\n'
for m in "${HF_MODELS[@]}"; do
  curl -s -m 15 "https://huggingface.co/api/models/$m" | python3 -I -c "$HF_PARSE" "$m"
done

echo
echo "## GitHub repo health"
printf 'repo\tstars\tlast_push\tlicense\tarchived\n'
for r in "${GH_REPOS[@]}"; do
  gh api "repos/$r" --jq '[.full_name, .stargazers_count, .pushed_at[:10], (.license.spdx_id // "none"), .archived] | @tsv' \
    || printf '%s\tERROR\n' "$r"
done

echo
echo "Note: NOASSERTION/other/none means read the LICENSE file. Model cards can also restrict weights separately from code."
