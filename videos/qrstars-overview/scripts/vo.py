"""Озвучка Voicebox (профиль Deva1) → assets/vo/<id>.mp3. Запуск: python3 scripts/vo.py [id ...]"""
import json, os, subprocess, sys, time, urllib.request
BASE = "http://127.0.0.1:17493"
PROFILE = "72bca54f-69a5-4730-b0fe-1a8830b3df47"  # Deva1
H = {"Content-Type": "application/json", "X-Voicebox-Client-Id": "claude-code"}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lines = json.load(open(os.path.join(ROOT, "scripts", "vo_lines.json")))
only = set(sys.argv[1:])
for i, (sid, text) in enumerate(lines):
    if only and sid not in only:
        continue
    req = urllib.request.Request(f"{BASE}/generate", headers=H, data=json.dumps(
        {"profile_id": PROFILE, "text": text, "language": "ru", "seed": int(os.environ.get("SEED", 100)) + i}).encode())
    gid = json.loads(urllib.request.urlopen(req, timeout=60).read())["id"]
    t0 = time.time()
    while True:
        time.sleep(1)
        h = json.loads(urllib.request.urlopen(urllib.request.Request(f"{BASE}/history/{gid}", headers=H)).read())
        if h.get("status") == "completed":
            break
        if h.get("status") == "failed" or time.time() - t0 > 300:
            raise SystemExit(f"{sid}: {h.get('status')} {h.get('error')}")
    raw = f"/tmp/vo_{sid}.wav"
    open(raw, "wb").write(urllib.request.urlopen(urllib.request.Request(f"{BASE}/audio/{gid}", headers=H)).read())
    dst = os.path.join(ROOT, "assets", "vo", f"{sid}.mp3")
    subprocess.run(["ffmpeg", "-y", "-i", raw, "-af",
        "silenceremove=start_periods=1:start_duration=0.04:start_threshold=-40dB,areverse,"
        "silenceremove=start_periods=1:start_duration=0.08:start_threshold=-35dB,areverse,"
        "atempo=1.06,loudnorm=I=-16:TP=-1.5:LRA=10", "-ar", "44100", "-b:a", "192k", dst],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    d = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", dst]).decode().strip()
    print(sid, f"{float(d):.2f}s", f"gen {time.time()-t0:.0f}s", flush=True)
