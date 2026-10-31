# Running the small model on the Windows PC (work-windows, RTX 4060)

Files live in `C:\Users\pujan\llama.cpp`: `b12000-cu124\llama-server.exe` and `LFM3-1.7B-Q4_K_M.gguf`
(from `LiquidAI/LFM3-1.7B-GGUF`). Use the CUDA 12.4 build; the 13.4 build needs a newer driver than 592.00.

Start it from the Mac through an SSH tunnel (the server stops when the tunnel closes):

    ssh -L 11436:127.0.0.1:8080 work-windows "C:\Users\pujan\llama.cpp\b12000-cu124\llama-server.exe -m C:\Users\pujan\llama.cpp\LFM3-1.7B-Q4_K_M.gguf --host 127.0.0.1 --port 8080 -ngl 99 -c 4096 --jinja --sleep-idle-seconds 300"

`--sleep-idle-seconds 300` unloads the model after 5 idle minutes (RAM 1.5 GB -> 0.3 GB, GPU 1.7 GB -> 0.5 GB)
and the next request wakes it in about 4 s. Then `npm run scenarios:llama` talks to `http://127.0.0.1:11436`.

Gotchas seen: the GPU only works with the CUDA 12.4 build; the Q8 file did not fit the GPU budget over SSH; the first
launch sometimes dies with a CUDA error, so retry once; stale `llama-server.exe` processes hold ~2 GB RAM each, so
check `tasklist` before starting another.
