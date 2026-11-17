import torch, numpy as np, scipy.io.wavfile as wv, os
from transformers import AutoProcessor, MusicgenForConditionalGeneration
D=os.path.dirname(os.path.abspath(__file__))
dev = "mps" if torch.backends.mps.is_available() else "cpu"
proc = AutoProcessor.from_pretrained("facebook/musicgen-small")
model = MusicgenForConditionalGeneration.from_pretrained("facebook/musicgen-small").to(dev)
prompts = {
 "a": "light cheerful background jingle for a tech product video, plucked ukulele, soft glockenspiel, gentle finger snaps, bright major key, 110 bpm, airy, minimal, no vocals",
 "b": "soft happy corporate background music, clean electric piano and light marimba, gentle shaker, warm, positive, relaxed, 105 bpm, no vocals",
 "c": "playful light acoustic background tune, acoustic guitar picking, bells, soft claps, sunny optimistic advertising music, 112 bpm, simple, no vocals",
}
for k, p in prompts.items():
    torch.manual_seed(7)
    inp = proc(text=[p], padding=True, return_tensors="pt").to(dev)
    out = model.generate(**inp, do_sample=True, guidance_scale=3.0, max_new_tokens=1500)
    a = out[0, 0].float().cpu().numpy()
    wv.write(f"{D}/bgm_{k}.wav", model.config.audio_encoder.sampling_rate, a)
    print(k, len(a)/model.config.audio_encoder.sampling_rate, flush=True)
