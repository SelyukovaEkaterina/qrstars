"""python3 stress.py <substr> files... — пик энергии внутри слова (0..1)."""
import json, subprocess, sys, os, numpy as np
sub = sys.argv[1].lower()
for f in sys.argv[2:]:
    d = f + ".t"; os.makedirs(d, exist_ok=True)
    if not os.path.exists(f"{d}/transcript.json"):
        subprocess.run(["npx","--yes","hyperframes@0.8.228","transcribe",f,"-m","small","-l","ru","--json","-d",d],capture_output=True)
    words = json.load(open(f"{d}/transcript.json"))
    if isinstance(words, dict): words = words.get("words", [])
    a = np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",f,"-ac","1","-ar","16000","-f","f32le","-"],capture_output=True).stdout, dtype=np.float32)
    res = []
    for w in words:
        if sub in w["text"].lower():
            seg = a[int(w["start"]*16000):int(w["end"]*16000)]
            rms = np.array([np.sqrt(np.mean(seg[i:i+480]**2)) for i in range(0, max(1,len(seg)-480), 160)])
            if len(rms) < 3: continue
            act = np.where(rms > 0.15*rms.max())[0]; rms = rms[act[0]:act[-1]+1]
            k = np.convolve(rms, np.ones(5)/5, mode="same"); n=len(k)
            res.append(f"{w['text']}[peak={np.argmax(k)/n:.2f} first={k[:n//3].sum()/k.sum():.2f} last={k[2*n//3:].sum()/k.sum():.2f}]")
    print(os.path.basename(f), " | ".join(res), "\n   ", " ".join(w["text"] for w in words), flush=True)
