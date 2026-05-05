#!/usr/bin/env bash
# Build post-03-reel.mp4 with element-level animations.
# Output: 1080x1920 30fps, ~12s, no audio.
set -euo pipefail

cd "$(dirname "$0")"
OUT=out
W=1080
H=1920
FPS=30

mkdir -p "$OUT/segments"

# ---------- Scene 1: Cover (3.0s) — Ken Burns via overlay+scale ----------
# Generate a black 1080x1920 base, overlay the cover scaled w/ time-varying zoom.
ffmpeg -y -loglevel error \
  -f lavfi -t 3.0 -r ${FPS} -i "color=c=black:s=${W}x${H}" \
  -loop 1 -t 3.0 -r ${FPS} -i "$OUT/post-03-cover.png" \
  -filter_complex "
    [1:v]scale=
      w='${W}*(1.0+0.025*t)':
      h='${H}*(1.0+0.025*t)':eval=frame[zoomed];
    [0:v][zoomed]overlay=
      x='(W-w)/2':
      y='(H-h)/2':shortest=1,
    fps=${FPS},format=yuv420p
  " -t 3.0 -c:v libx264 -pix_fmt yuv420p -r ${FPS} "$OUT/segments/s1.mp4"

# ---------- Scene 2: Code pill (3.5s) ----------
# Bg static. Pill enters 0.0-0.5s scale 0.4 -> 1.0, then 2 pulses at 1.5s and 2.4s.
ffmpeg -y -loglevel error \
  -loop 1 -t 3.5 -r ${FPS} -i "$OUT/post-03-frame-02-code-bg.png" \
  -loop 1 -t 3.5 -r ${FPS} -i "$OUT/post-03-frame-02-pill.png" \
  -filter_complex "
    [0:v]scale=${W}:${H},setsar=1,format=yuv420p[bg];
    [1:v]scale=1080:-1,format=rgba,
      scale=
        w='1080*if(lt(t,0.5), 0.4+1.2*t, if(lt(t,1.5), 1.0, if(lt(t,1.7), 1.0+0.06*sin((t-1.5)/0.2*PI), if(lt(t,2.4), 1.0, if(lt(t,2.6), 1.0+0.06*sin((t-2.4)/0.2*PI), 1.0)))))':
        h=-1:eval=frame[pill];
    [bg][pill]overlay=
      x='(W-w)/2':
      y='(H-h)/2 - 120':shortest=1,
    fps=${FPS},format=yuv420p
  " -t 3.5 -c:v libx264 -pix_fmt yuv420p -r ${FPS} "$OUT/segments/s2.mp4"

# ---------- Scene 3: Steps (3.5s) ----------
# Whole steps frame slides up from bottom (offset +120 to 0 in 0.6s) then static.
ffmpeg -y -loglevel error \
  -f lavfi -t 3.5 -r ${FPS} -i "color=c=#221610:s=${W}x${H}" \
  -loop 1 -t 3.5 -r ${FPS} -i "$OUT/post-03-frame-03-steps.png" \
  -filter_complex "
    [1:v]scale=${W}:${H},setsar=1,format=yuv420p[steps];
    [0:v][steps]overlay=
      x=0:
      y='if(lt(t,0.6), 120-200*t, 0)':shortest=1,
    fps=${FPS},format=yuv420p
  " -t 3.5 -c:v libx264 -pix_fmt yuv420p -r ${FPS} "$OUT/segments/s3.mp4"

# ---------- Scene 4: Countdown (2.5s) ----------
# Bg static. Clock pulses scale 1.0 <-> 1.05 every 0.8s.
ffmpeg -y -loglevel error \
  -loop 1 -t 2.5 -r ${FPS} -i "$OUT/post-03-frame-04-countdown-bg.png" \
  -loop 1 -t 2.5 -r ${FPS} -i "$OUT/post-03-frame-04-clock.png" \
  -filter_complex "
    [0:v]scale=${W}:${H},setsar=1,format=yuv420p[bg];
    [1:v]scale=1080:-1,format=rgba,
      scale=
        w='1080*(1.0+0.05*sin(2*PI*t/0.8))':
        h=-1:eval=frame[clock];
    [bg][clock]overlay=
      x='(W-w)/2':
      y=380:shortest=1,
    fps=${FPS},format=yuv420p
  " -t 2.5 -c:v libx264 -pix_fmt yuv420p -r ${FPS} "$OUT/segments/s4.mp4"

# Verify segment durations
echo "Segment durations:"
for f in s1 s2 s3 s4; do
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/segments/$f.mp4")
  echo "  $f: ${dur}s"
done

# ---------- Concat with xfade ----------
# Targeted: 3.0, 3.5, 3.5, 2.5  Total ~12.5s with 0.3s overlaps -> ~11.6s
# Offsets: 2.7, 5.9, 9.1
ffmpeg -y -loglevel error \
  -i "$OUT/segments/s1.mp4" \
  -i "$OUT/segments/s2.mp4" \
  -i "$OUT/segments/s3.mp4" \
  -i "$OUT/segments/s4.mp4" \
  -filter_complex "
    [0:v][1:v]xfade=transition=fade:duration=0.3:offset=2.7[v01];
    [v01][2:v]xfade=transition=fade:duration=0.3:offset=5.9[v012];
    [v012][3:v]xfade=transition=fade:duration=0.3:offset=9.1,format=yuv420p[vout]
  " -map "[vout]" -c:v libx264 -pix_fmt yuv420p -r ${FPS} -movflags +faststart \
  "$OUT/post-03-reel.mp4"

echo ""
echo "✓ Built: $OUT/post-03-reel.mp4"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT/post-03-reel.mp4" | awk '{printf "  Duration: %.2fs\n", $1}'
ls -lh "$OUT/post-03-reel.mp4" | awk '{print "  Size:    " $5}'
