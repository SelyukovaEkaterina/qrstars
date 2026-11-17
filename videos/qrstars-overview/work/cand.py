"""Дубли озвучки: python3 cand.py <tag> <seed1,seed2> <text> → cand/<tag>_<seed>.mp3"""
import json, os, subprocess, sys, time, urllib.request
BASE="http://127.0.0.1:17493"; PROFILE="72bca54f-69a5-4730-b0fe-1a8830b3df47"
H={"Content-Type":"application/json","X-Voicebox-Client-Id":"claude-code"}
D=os.path.join(os.path.dirname(os.path.abspath(__file__)),"cand")
tag, seeds, text = sys.argv[1], [int(s) for s in sys.argv[2].split(",")], sys.argv[3]
for seed in seeds:
    req=urllib.request.Request(f"{BASE}/generate",headers=H,data=json.dumps({"profile_id":PROFILE,"text":text,"language":"ru","seed":seed}).encode())
    gid=json.loads(urllib.request.urlopen(req,timeout=120).read())["id"]
    while True:
        time.sleep(1)
        h=json.loads(urllib.request.urlopen(urllib.request.Request(f"{BASE}/history/{gid}",headers=H)).read())
        if h.get("status")=="completed": break
        if h.get("status")=="failed": raise SystemExit(h)
    raw=f"{D}/{tag}_{seed}.wav"
    open(raw,"wb").write(urllib.request.urlopen(urllib.request.Request(f"{BASE}/audio/{gid}",headers=H)).read())
    subprocess.run(["ffmpeg","-y","-i",raw,"-af","silenceremove=start_periods=1:start_duration=0.04:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_duration=0.08:start_threshold=-35dB,areverse,atempo=1.06,loudnorm=I=-16:TP=-1.5:LRA=10","-ar","44100","-b:a","192k",f"{D}/{tag}_{seed}.mp3"],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    print(tag, seed, "ok", flush=True)
