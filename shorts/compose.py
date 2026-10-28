# ==========================================================================
# shorts/compose.py: turns the recording from record.mjs into a YouTube Short
#
#   python shorts/compose.py <outDir>
#
# The video is 1080x1920 (phone, upright):
#   Shell Key logo and product name at the top,
#   the demo in the middle,
#   a caption for each screen, the voice underneath,
#   a green "Try the free demo" button, then an end card.
# Writes <outDir>/short.mp4 and <outDir>/youtube.json (title, description).
# ==========================================================================
import json, os, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "shorts-out")
job = json.load(open(os.path.join(out, "job.json")))

W, H = 1080, 1920
NAVY, GREEN, WHITE, MUTED = (7, 20, 42), (124, 255, 0), (234, 242, 255), (170, 190, 220)
font = lambda w, s: ImageFont.truetype(os.path.join(HERE, "fonts", f"Inter-{w}.otf"), s)
logo = Image.open(os.path.join(ROOT, "assets/img/logo/ShellKeyWhiteTrace.png")).convert("RGBA")
P = lambda name: os.path.join(out, name)

def base():
    im = Image.new("RGB", (W, H), NAVY); d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(7 + 10 * (1 - t)), int(20 + 18 * (1 - t)), int(42 + 40 * (1 - t))))
    return im, d

def center(d, y, text, f, fill):
    d.text(((W - d.textlength(text, font=f)) / 2, y), text, font=f, fill=fill)

def fit(d, text, weight, size, maxw):
    while size > 30 and d.textlength(text, font=font(weight, size)) > maxw: size -= 2
    return font(weight, size)

# Main frame
im, d = base()
lg = logo.copy(); lg.thumbnail((380, 200)); im.paste(lg, ((W - lg.width) // 2, 70), lg)
center(d, 300, job["title"], fit(d, job["title"], "Bold", 72, W - 100), WHITE)
center(d, 395, job["tagline"], fit(d, job["tagline"], "Medium", 38, W - 100), MUTED)
d.rounded_rectangle([(90, 1600), (W - 90, 1730)], 34, fill=GREEN)
center(d, 1628, "Try the free demo", font("Bold", 60), NAVY)
center(d, 1765, job["url"], fit(d, job["url"], "Medium", 36, W - 80), WHITE)
im.save(P("frame.png"))

# End card
im, d = base()
lg = logo.copy(); lg.thumbnail((620, 330)); im.paste(lg, ((W - lg.width) // 2, 470), lg)
center(d, 880, job["title"], fit(d, job["title"], "Bold", 70, W - 100), WHITE)
d.rounded_rectangle([(90, 1040), (W - 90, 1180)], 36, fill=GREEN)
center(d, 1072, "Try the free demo", font("Bold", 64), NAVY)
center(d, 1225, "Free in your browser · no card · no install", font("Medium", 38), MUTED)
center(d, 1300, job["url"], fit(d, job["url"], "SemiBold", 40, W - 80), WHITE)
im.save(P("end.png"))

# One caption picture per scene
for i, s in enumerate(job["scenes"]):
    c = Image.new("RGBA", (W, 200), (0, 0, 0, 0)); cd = ImageDraw.Draw(c); f = font("Bold", 54)
    lines, cur = [], ""
    for w_ in s["caption"].split():
        t = (cur + " " + w_).strip()
        if cd.textlength(t, font=f) > W - 120 and cur: lines.append(cur); cur = w_
        else: cur = t
    lines.append(cur)
    y = 100 - len(lines) * 34
    for ln in lines:
        cd.text(((W - cd.textlength(ln, font=f)) / 2, y), ln, font=f, fill=WHITE); y += 68
    c.save(P(f"cap{i}.png"))

dur = job["end"] - job["start"]
endd = job["endCard"]["dur"]
total = dur + endd
if not 10 <= total <= 30.5:
    sys.exit(f"Video would be {total:.1f}s; it must be 10 to 30 seconds.")

inputs = ["-loop", "1", "-t", f"{dur:.2f}", "-i", P("frame.png"),
          "-ss", f"{job['start']:.2f}", "-t", f"{dur:.2f}", "-i", job["raw"]]
for i, _ in enumerate(job["scenes"]):
    inputs += ["-loop", "1", "-t", f"{dur:.2f}", "-i", P(f"cap{i}.png")]
inputs += ["-loop", "1", "-t", f"{endd:.2f}", "-i", P("end.png")]
n_img = 2 + len(job["scenes"]) + 1

fc = ["[1:v]crop=1000:720:140:0,scale=1080:778,pad=1092:790:6:6:color=0x7cff00[app]",
      "[0:v][app]overlay=-6:480[v0]"]
last = "v0"
for i, s in enumerate(job["scenes"]):
    fc.append(f"[{last}][{i + 2}:v]overlay=0:1320:enable='between(t,{s['t']:.2f},{s['until']:.2f})'[v{i + 1}]")
    last = f"v{i + 1}"
endi = n_img - 1
fc += [f"[{last}]fps=30,format=yuv420p,setsar=1[main]",
       f"[{endi}:v]fps=30,format=yuv420p,setsar=1,fade=t=in:st=0:d=0.4[endc]",
       "[main][endc]concat=n=2:v=1:a=0[vout]"]

# Voice: each line starts when its screen starts; the closing line plays on the end card
clips = [(s["audio"], s["t"] + 0.2) for s in job["scenes"] if s.get("audio")]
if job["endCard"].get("audio"): clips.append((job["endCard"]["audio"], dur + 0.25))
amap = []
if clips:
    for k, (a, at) in enumerate(clips):
        inputs += ["-i", a]
        ms = int(at * 1000)
        fc.append(f"[{n_img + k}:a]aresample=48000,adelay={ms}|{ms}[a{k}]")
    mix = "".join(f"[a{k}]" for k in range(len(clips)))
    fc.append(f"{mix}amix=inputs={len(clips)}:normalize=0:dropout_transition=0,apad,atrim=0:{total:.2f}[aout]")
    amap = ["-map", "[aout]", "-c:a", "aac", "-b:a", "160k"]
else:
    # Silent track so every upload has audio (YouTube handles it better)
    inputs += ["-f", "lavfi", "-t", f"{total:.2f}", "-i", "anullsrc=r=48000:cl=stereo"]
    amap = ["-map", f"{n_img}:a", "-c:a", "aac", "-b:a", "96k"]

video = P("short.mp4")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", *inputs, "-filter_complex", ";".join(fc),
                "-map", "[vout]", *amap, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                "-movflags", "+faststart", "-shortest", video], check=True)

# Title and description for YouTube (the link carries tracking so the CRM can count visits)
link = f"https://shellkey.company/products/{job['slug']}.html?utm_source=youtube&utm_medium=video&utm_campaign=yt-{job['slug']}"
lines = [f"{job['tagline']}. Try the free demo: no card, no install.", "", link, ""]
lines += [f"• {s['caption']}" for s in job["scenes"]]
lines += ["", "Shell Key · Lafayette, Louisiana · shellkey.company", job.get("hashtags") or "#Shorts #ProjectControls #Construction"]
meta = {"title": f"{job['title']}: try the free demo #Shorts"[:100], "description": "\n".join(lines),
        "tags": ["Shell Key", job["title"], "free demo"] + ([] if job.get("hashtags") else ["project controls", "construction software"]), "video": video}
json.dump(meta, open(P("youtube.json"), "w"), indent=1)
print(f"Wrote {video} ({total:.1f}s, voice {'on' if clips else 'off'})")
