import urllib.request
import json
import base64
import re
import sys

API_KEY = "sk-hydra-ai-nW826kcQbVmJ.l0.NdtbZPidCsiq-cDil0IeuttXkj.FVIi3Iew2Fx93xFBaByUz"
BASE_URL = "https://api.hydraai.ru/v1"

def generate_image(prompt: str, output_path: str = "output.png", model: str = "hydra-banana-pro"):
    print(f"Generating image for prompt: {prompt}")
    
    req = urllib.request.Request(
        f"{BASE_URL}/chat/completions",
        data=json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
        }).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            data = json.loads(response.read().decode("utf-8"))
            
            content = data["choices"][0]["message"]["content"]
            
            match = re.search(r'data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)', content)
            if match:
                ext = "jpg" if match.group(1) == "jpeg" else match.group(1)
                out = output_path if output_path.endswith(f".{ext}") else f"{output_path.rsplit('.', 1)[0]}.{ext}"
                with open(out, "wb") as f:
                    f.write(base64.b64decode(match.group(2)))
                print(f"Saved: {out}")
                return out
            else:
                print("No image found in response")
                return None
    except Exception as e:
        print(f"Error: {e}")
        if hasattr(e, 'read'):
            print(e.read().decode('utf-8'))

if __name__ == "__main__":
    prompt = "A realistic photo of a wooden table in a cozy modern cafe. On the table, there is a small stylish acrylic table tent with a QR code on it. Next to the table tent is a cup of cappuccino with beautiful latte art. Soft natural lighting, shallow depth of field, blurred background with cafe interior. High quality, 4k. Aspect ratio: 16:9"
    generate_image(prompt, "public/images/cafe-qr.jpg")
