import { spawn } from "node:child_process";
import { readFile, writeFile, stat } from "node:fs/promises";
import { resolve, basename } from "node:path";
import ffmpeg from "ffmpeg-static";
import ffprobe from "ffprobe-static";

export const chapters = [
  { scene: "documents", word: "Ask", start: 0 },
  { scene: "search", word: "Search", start: 4 },
  { scene: "chat", word: "Ask", start: 7 },
  { scene: "sources", word: "Trace", start: 9.5 },
  { scene: "vectors", word: "Inspect", start: 11.5 },
  { scene: "documents", word: "Ask", start: 14.5 },
];

export function run(binary, args) {
  return new Promise((done, reject) => {
    const child = spawn(binary, args, { windowsHide: true });
    let stdout = "", stderr = "";
    child.stdout.on("data", data => stdout += data);
    child.stderr.on("data", data => stderr += data);
    child.once("error", reject);
    child.once("close", code => code === 0 ? done(stdout) : reject(new Error(`${basename(binary)} exited ${code}\n${stderr.slice(-5000)}`)));
  });
}

export async function probe(file) {
  return JSON.parse(await run(ffprobe.path, ["-v", "error", "-show_streams", "-show_format", "-of", "json", file]));
}

export async function encodeFilm(capture, destination) {
  const { directory, variant, width, height } = capture;
  const frames = [...capture.frames].sort((a, b) => a.timestamp - b.timestamp);
  const first = frames[0].timestamp;
  const concat = frames.map((frame, index) => {
    const next = frames[index + 1];
    const duration = next ? next.timestamp - frame.timestamp : Math.max(.05, 14.65 - (frame.timestamp - first));
    // Millisecond PNG timebases preserve CDP cadence; the image demuxer's
    // default 25fps otherwise rounds short token frames and shifts the story.
    return `file '${frame.file}'\noption framerate 1000\nduration ${Math.max(.001, duration).toFixed(6)}`;
  }).join("\n") + `\nfile '${frames.at(-1).file}'\noption framerate 1000\n`;
  const input = resolve(directory, "frames.txt"), raw = resolve(directory, "raw.mkv");
  await writeFile(input, concat);
  // Keep native PNG detail intact until the one final H.264 encode. A lossy
  // intermediate softened small text before the published encode even began.
  await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", input,
    "-vf", "fps=24,setsar=1", "-c:v", "ffv1", "-level", "3", "-pix_fmt", "bgr0", "-an", raw]);
  const movie = resolve(destination, `neuebit-${variant}.mp4`), poster = resolve(destination, `neuebit-${variant}.webp`);
  const fade = 4 / 24;
  const sourceSegments = [];
  const filters = chapters.slice(0, 5).map((chapter, index) => {
    const end = chapters[index + 1].start;
    const sourceStart = Math.ceil(Math.max(chapter.start, capture.sceneStarts[chapter.scene]) * 24) / 24;
    if (!Number.isFinite(sourceStart) || sourceStart >= end) throw new Error(`No settled ${chapter.scene} capture before its chapter ends: ${variant}`);
    // Cut native entry transitions, then extend the readable ending hold to
    // keep the directed timeline intact. Dissolves join actual settled views.
    sourceSegments.push({ scene: chapter.scene, sourceStartSeconds: sourceStart, sourceEndSeconds: end, outputStartSeconds: chapter.start });
    return `[0:v]trim=start=${sourceStart}:end=${end},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=${fade + sourceStart - chapter.start},settb=AVTB,format=yuv420p[c${index}]`;
  });
  // An exact opening frame makes the last hold and first frame identical.
  filters.push("[1:v]fps=24,trim=duration=1.5,setpts=PTS-STARTPTS,settb=AVTB,format=yuv420p[c5]");
  let previous = "c0";
  for (let index = 1; index < 6; index++) {
    const output = `mix${index}`;
    filters.push(`[${previous}][c${index}]xfade=transition=fade:duration=${fade}:offset=${chapters[index].start}[${output}]`);
    previous = output;
  }
  await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", raw, "-loop", "1", "-framerate", "24", "-i", resolve(directory, frames[0].file),
    "-filter_complex", filters.join(";"), "-map", `[${previous}]`, "-frames:v", "384", "-r", "24", "-c:v", "libx264",
    "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", movie]);
  await run(ffmpeg, ["-y", "-hide_banner", "-loglevel", "error", "-i", movie, "-frames:v", "1", "-vf", "format=rgb24", "-c:v", "libwebp", "-lossless", "1", poster]);
  const metadata = await probe(movie), image = await probe(poster);
  const track = metadata.streams.find(stream => stream.codec_type === "video");
  if (track.width !== width || track.height !== height || image.streams[0].width !== width || image.streams[0].height !== height
    || track.codec_name !== "h264" || track.pix_fmt !== "yuv420p" || track.avg_frame_rate !== "24/1" || Number(track.nb_frames) !== 384
    || Math.abs(Number(metadata.format.duration) - 16) > 1 / 24 || metadata.streams.some(stream => stream.codec_type === "audio")) {
    throw new Error(`Encoded metadata failed for ${variant}`);
  }
  const movieBytes = await readFile(movie), atoms = [];
  for (let offset = 0; offset + 8 <= movieBytes.length;) {
    const smallSize = movieBytes.readUInt32BE(offset);
    const size = smallSize === 1 ? Number(movieBytes.readBigUInt64BE(offset + 8)) : smallSize || movieBytes.length - offset;
    if (size < 8 || offset + size > movieBytes.length) throw new Error(`Invalid MP4 atom in ${variant}`);
    atoms.push(movieBytes.toString("ascii", offset + 4, offset + 8)); offset += size;
  }
  const faststart = atoms.indexOf("moov") >= 0 && atoms.indexOf("moov") < atoms.indexOf("mdat");
  if (!faststart) throw new Error(`MP4 metadata is not before media data: ${variant}`);
  // Compare decoded RGB, not compressed bytes, including the clean loop hold.
  const head = resolve(directory, "first.rgb"), tail = resolve(directory, "last.rgb"), still = resolve(directory, "poster.rgb");
  const reference = resolve(directory, "reference.rgb"), luma = resolve(directory, "frames.gray");
  await run(ffmpeg, ["-y", "-v", "error", "-i", movie, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", head]);
  await run(ffmpeg, ["-y", "-v", "error", "-ss", "15.958333", "-i", movie, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", tail]);
  await run(ffmpeg, ["-y", "-v", "error", "-i", poster, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", still]);
  await run(ffmpeg, ["-y", "-v", "error", "-i", resolve(directory, frames[0].file), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", reference]);
  await run(ffmpeg, ["-y", "-v", "error", "-i", movie, "-vf", "scale=16:9,format=gray", "-f", "rawvideo", luma]);
  const [firstPixels, lastPixels, posterPixels] = await Promise.all([readFile(head), readFile(tail), readFile(still)]);
  if (!firstPixels.equals(posterPixels)) throw new Error(`Poster differs from decoded opening frame: ${variant}`);
  const loopMeanError = firstPixels.reduce((sum, value, index) => sum + Math.abs(value - lastPixels[index]), 0) / firstPixels.length;
  if (lastPixels.length !== firstPixels.length || loopMeanError > 1.5) throw new Error(`Loop mismatch: ${variant} (${loopMeanError})`);
  const sourcePixels = await readFile(reference), lumaPixels = await readFile(luma);
  if (sourcePixels.length !== width * height * 3 || firstPixels.length !== sourcePixels.length) throw new Error(`Native pixel dimensions changed: ${variant}`);
  // Compare grayscale edge contrast in the opening header, navigation and
  // document area. Compression must retain the captured text's definition.
  const gray = (pixels, index) => .2126 * pixels[index] + .7152 * pixels[index + 1] + .0722 * pixels[index + 2];
  function edgeContrast(pixels) {
    let total = 0;
    for (let y = 16; y < 390; y++) for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 3;
      total += Math.abs(gray(pixels, index) - gray(pixels, index - 3));
      total += Math.abs(gray(pixels, index) - gray(pixels, index - width * 3));
    }
    return total;
  }
  const edgeRetention = edgeContrast(firstPixels) / edgeContrast(sourcePixels);
  if (!Number.isFinite(edgeRetention) || edgeRetention < .92) throw new Error(`Text edge contrast lost: ${variant} (${edgeRetention})`);
  let minimumFrameLuma = 255;
  if (lumaPixels.length !== 384 * 16 * 9) throw new Error(`Incomplete full-film decode: ${variant}`);
  for (let offset = 0; offset < lumaPixels.length; offset += 144) {
    const mean = lumaPixels.subarray(offset, offset + 144).reduce((sum, value) => sum + value, 0) / 144;
    minimumFrameLuma = Math.min(minimumFrameLuma, mean);
  }
  if (minimumFrameLuma < 8) throw new Error(`Black frame detected: ${variant}`);
  return { file: basename(movie), bytes: (await stat(movie)).size, durationSeconds: Number(metadata.format.duration),
    width, height, fps: 24, codec: track.codec_name, pixelFormat: track.pix_fmt, audioTracks: 0, viewport: { width, height },
    theme: variant.endsWith("light") ? "light" : "dark", chapters, sourceSegments,
    poster: { file: basename(poster), bytes: (await stat(poster)).size, width, height, timeSeconds: 0 },
    validation: { posterMatchesFirstFrame: true, loopMeanPixelError: Number(loopMeanError.toFixed(4)), faststart,
      nativeCaptureResolution: true, openingTextEdgeRetention: Number(edgeRetention.toFixed(4)), decodedFrames: 384,
      minimumFrameLuma: Number(minimumFrameLuma.toFixed(2)) } };
}
