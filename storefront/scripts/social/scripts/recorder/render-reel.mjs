#!/usr/bin/env node
/**
 * Enrola hyperframes → mp4 recorder.
 *
 * What it does:
 *   1. Boots headless Chrome via Puppeteer at 1080×1920.
 *   2. Loads source/hyperframes/index.html (GSAP timeline exposed at
 *      window.__timelines.main, paused).
 *   3. Reads duration from <audio id="voice" data-duration="N">.
 *   4. Steps through the timeline at 30 fps, screenshots each frame.
 *   5. Calls ffmpeg to:
 *        - encode the frame sequence at 30 fps,
 *        - mix narration.mp3 (1.0) + bg-music.mp3 (0.20),
 *        - mux into reel.mp4 next to the post folder.
 *   6. Cleans up the temp frame dir.
 *
 * Why this exists:
 *   Hyperframes is HeyGen's commercial format and doesn't ship a CLI we can
 *   call. The HTML output is fully self-contained though — GSAP runs the
 *   animation, audio refs are local files, fonts via CDN. Driving the
 *   timeline from outside (seek + screenshot loop) is deterministic and
 *   gets us pixel-perfect frames at any fps, no screen-record nonsense.
 *
 * Usage:
 *   node render-reel.mjs <post-folder>
 *   node render-reel.mjs ../../mes-2/post-07-pedido-bts
 *
 * Output:
 *   <post-folder>/reel.mp4
 */
import { execSync, spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { fileURLToPath, pathToFileURL } from "node:url"
import puppeteer from "puppeteer"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const FPS = 30
const W = 1080
const H = 1920

// ── CLI ──────────────────────────────────────────────────────────────
const postArg = process.argv[2]
if (!postArg) {
  console.error("usage: render-reel.mjs <post-folder>")
  console.error("  e.g. render-reel.mjs ../../mes-2/post-07-pedido-bts")
  process.exit(1)
}
const postDir = path.resolve(process.cwd(), postArg)
const indexHtml = path.join(postDir, "source", "hyperframes", "index.html")
const narrationMp3 = path.join(postDir, "source", "hyperframes", "narration.mp3")
const bgmMp3 = path.join(postDir, "source", "hyperframes", "bg-music.mp3")
const outMp4 = path.join(postDir, "reel.mp4")

for (const p of [indexHtml, narrationMp3, bgmMp3]) {
  if (!fs.existsSync(p)) {
    console.error(`✗ missing required file: ${p}`)
    process.exit(1)
  }
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "enrola-reel-"))
console.log(`▶ rendering ${path.basename(postDir)}`)
console.log(`  frames → ${tmpDir}`)
console.log(`  output → ${outMp4}`)

// ── Capture frames ───────────────────────────────────────────────────
const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ["--allow-file-access-from-files", "--no-sandbox", "--disable-web-security"],
})

try {
  const page = await browser.newPage()

  // Suppress autoplay — we drive the timeline manually. Audio in the HTML
  // is for HeyGen runtime only; we mux real audio with ffmpeg afterwards.
  await page.evaluateOnNewDocument(() => {
    HTMLMediaElement.prototype.play = function () { return Promise.resolve() }
    HTMLMediaElement.prototype.pause = function () {}
  })

  await page.goto(pathToFileURL(indexHtml).href, { waitUntil: "networkidle0", timeout: 60_000 })

  // GSAP timeline + audio metadata both need to be in the DOM. Wait up to 10s.
  await page.waitForFunction(
    () =>
      window.__timelines &&
      window.__timelines.main &&
      document.querySelector('audio#voice')?.dataset?.duration,
    { timeout: 10_000 }
  )

  // Give web fonts a beat to settle (Kanit from Google Fonts via the link
  // tag). 500 ms beats a flash of unstyled text on frame 1.
  await new Promise((r) => setTimeout(r, 500))
  await page.evaluate(() => document.fonts.ready)

  const duration = await page.evaluate(() => {
    const v = document.querySelector('audio#voice')
    return parseFloat(v.dataset.duration)
  })
  if (!duration || isNaN(duration)) {
    throw new Error("could not read voice duration from audio[data-duration]")
  }
  // Add a small tail so the last GSAP transition can finish smoothly.
  const totalDuration = duration + 0.3
  const totalFrames = Math.ceil(totalDuration * FPS)
  console.log(`  duration: ${totalDuration.toFixed(2)}s · ${totalFrames} frames @ ${FPS}fps`)

  const t0 = Date.now()
  for (let i = 0; i < totalFrames; i++) {
    const t = i / FPS
    await page.evaluate((time) => {
      window.__timelines.main.seek(time)
    }, t)
    await page.screenshot({
      path: path.join(tmpDir, `frame-${String(i).padStart(5, "0")}.png`),
      type: "png",
      omitBackground: false,
      clip: { x: 0, y: 0, width: W, height: H },
    })
    if (i % 30 === 0) {
      const pct = ((i / totalFrames) * 100).toFixed(0)
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      process.stdout.write(`\r  capture: ${pct}% · ${elapsed}s elapsed`)
    }
  }
  process.stdout.write(`\r  capture: 100% · ${((Date.now() - t0) / 1000).toFixed(1)}s elapsed\n`)
} finally {
  await browser.close()
}

// ── Encode + mux ─────────────────────────────────────────────────────
console.log(`  encoding…`)

const ffmpegArgs = [
  "-y",
  "-loglevel", "error",
  "-framerate", String(FPS),
  "-i", path.join(tmpDir, "frame-%05d.png"),
  "-i", narrationMp3,
  "-i", bgmMp3,
  "-filter_complex",
  // mix voice (1.0) over bgm ducked at 0.20; pad/trim audio to video length
  "[1:a]volume=1.0[voice];[2:a]volume=0.20[bgm];[voice][bgm]amix=inputs=2:duration=longest:dropout_transition=0[aout]",
  "-map", "0:v",
  "-map", "[aout]",
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-preset", "medium",
  "-crf", "20",
  "-r", String(FPS),
  "-c:a", "aac",
  "-b:a", "192k",
  "-shortest",
  "-movflags", "+faststart",
  outMp4,
]

await new Promise((resolve, reject) => {
  const ff = spawn("ffmpeg", ffmpegArgs, { stdio: ["ignore", "inherit", "inherit"] })
  ff.on("error", reject)
  ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}`))))
})

// ── Cleanup + report ─────────────────────────────────────────────────
fs.rmSync(tmpDir, { recursive: true, force: true })

const stat = fs.statSync(outMp4)
const probe = execSync(
  `ffprobe -v error -show_entries format=duration -of csv=p=0 "${outMp4}"`,
).toString().trim()

console.log(`✓ done: ${outMp4}`)
console.log(`  size: ${(stat.size / 1024 / 1024).toFixed(2)} MB · duration: ${parseFloat(probe).toFixed(2)}s`)
