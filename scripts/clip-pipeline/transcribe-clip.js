#!/usr/bin/env node
'use strict';

/**
 * Transcribe a local MP4 (or any audio/video file ffmpeg can read) into text.
 *
 * Pipeline:
 *   1. Extract a compact mono 16kHz MP3 with ffmpeg.
 *   2. If the audio is larger than the Whisper upload limit, split it into
 *      time-based chunks so each piece stays under the cap.
 *   3. Transcribe each chunk with OpenAI Whisper and stitch the results,
 *      offsetting timestamps so segments line up across chunks.
 *   4. Write a .txt transcript (and optional .srt / .json) next to the input.
 *
 * Usage:
 *   node scripts/clip-pipeline/transcribe-clip.js INPUT.mp4 [options]
 *
 * Options:
 *   --out PATH        Output transcript path (default: alongside input, .txt)
 *   --lang CODE       Force a language (e.g. en, es). Default: auto-detect.
 *   --model NAME      OpenAI model (default: whisper-1)
 *   --srt             Also write an .srt subtitle file (implies timestamps)
 *   --json            Also write a .json file with segments + metadata
 *   --timestamps      Request segment timestamps (auto-on with --srt/--json)
 *   --keep-audio      Keep the extracted/chunked audio (default: cleaned up)
 *   --dry-run         Print ffmpeg/API actions without executing
 *
 * Requires OPENAI_API_KEY (loaded from .env / .env.local if dotenv is present).
 */

try {
  require('dotenv').config({ path: '.env.local' });
  require('dotenv').config();
} catch {
  // dotenv is optional; env vars may already be set in the shell.
}

const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');

const { runFfmpeg, getFfmpegPath } = require('./ffmpeg-utils');
const { isDryRun } = require('./lib/paths');

// Whisper rejects uploads over 25MB. Keep a margin under that.
const MAX_UPLOAD_BYTES = 24 * 1024 * 1024;
// Chunk length when the file is too big. At mono 16kHz ~48kbps this is ~6MB.
const CHUNK_SECONDS = 900;

function parseArgs(argv) {
  const opts = {
    input: null,
    out: null,
    lang: null,
    model: 'whisper-1',
    srt: false,
    json: false,
    timestamps: false,
    keepAudio: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--out':
        opts.out = argv[++i];
        break;
      case '--lang':
        opts.lang = argv[++i];
        break;
      case '--model':
        opts.model = argv[++i];
        break;
      case '--srt':
        opts.srt = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--timestamps':
        opts.timestamps = true;
        break;
      case '--keep-audio':
        opts.keepAudio = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown option: ${arg}`);
        }
        if (!opts.input) {
          opts.input = arg;
        }
    }
  }

  if (opts.srt || opts.json) {
    opts.timestamps = true;
  }

  return opts;
}

function printUsage() {
  console.error(
    [
      'Usage: node transcribe-clip.js INPUT.mp4 [options]',
      '',
      'Options:',
      '  --out PATH      Output transcript path (default: alongside input, .txt)',
      '  --lang CODE     Force language (e.g. en). Default: auto-detect',
      '  --model NAME    OpenAI model (default: whisper-1)',
      '  --srt           Also write .srt subtitles (implies --timestamps)',
      '  --json          Also write .json with segments (implies --timestamps)',
      '  --timestamps    Request segment timestamps',
      '  --keep-audio    Keep extracted audio files',
      '  --dry-run       Print actions without executing',
    ].join('\n')
  );
}

async function extractAudio(input, audioPath, dryRun) {
  await runFfmpeg(
    [
      '-y',
      '-i', input,
      '-vn',
      '-ac', '1',
      '-ar', '16000',
      '-c:a', 'libmp3lame',
      '-b:a', '48k',
      audioPath,
    ],
    { dryRun, captureStderr: false }
  );
}

async function splitAudio(audioPath, segmentDir, dryRun) {
  const pattern = path.join(segmentDir, 'chunk_%04d.mp3');
  await runFfmpeg(
    [
      '-y',
      '-i', audioPath,
      '-f', 'segment',
      '-segment_time', String(CHUNK_SECONDS),
      '-c', 'copy',
      pattern,
    ],
    { dryRun, captureStderr: false }
  );

  if (dryRun) {
    return [{ file: pattern, offset: 0 }];
  }

  const files = (await fsp.readdir(segmentDir))
    .filter((name) => name.startsWith('chunk_') && name.endsWith('.mp3'))
    .sort();

  return files.map((name, index) => ({
    file: path.join(segmentDir, name),
    offset: index * CHUNK_SECONDS,
  }));
}

function makeOpenAIFile(buffer, name) {
  if (typeof File !== 'undefined') {
    return new File([buffer], name, { type: 'audio/mpeg' });
  }
  const { Readable } = require('stream');
  const stream = Readable.from([buffer]);
  return Object.assign(stream, {
    name,
    type: 'audio/mpeg',
    size: buffer.length,
    [Symbol.toStringTag]: 'File',
  });
}

async function transcribeChunk(openai, chunkPath, { model, lang, timestamps }) {
  const buffer = await fsp.readFile(chunkPath);
  const audioFile = makeOpenAIFile(buffer, path.basename(chunkPath));

  return openai.audio.transcriptions.create({
    file: audioFile,
    model,
    language: lang || undefined,
    response_format: timestamps ? 'verbose_json' : 'json',
    timestamp_granularities: timestamps ? ['segment'] : undefined,
  });
}

function formatSrtTime(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(millis, 3)}`;
}

function buildSrt(segments) {
  return segments
    .map((seg, index) => {
      const start = formatSrtTime(seg.start);
      const end = formatSrtTime(seg.end);
      return `${index + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const dryRun = opts.dryRun || isDryRun();

  if (!opts.input) {
    printUsage();
    process.exit(1);
  }

  if (!dryRun && !fs.existsSync(opts.input)) {
    console.error(`[transcribe-clip] File not found: ${opts.input}`);
    process.exit(1);
  }

  if (!getFfmpegPath()) {
    console.error('[transcribe-clip] ffmpeg not found. Run `npm install` or set FFMPEG_PATH.');
    process.exit(1);
  }

  let openai = null;
  if (!dryRun) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('[transcribe-clip] OPENAI_API_KEY is not set. Add it to .env / .env.local.');
      process.exit(1);
    }
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  const baseName = path.basename(opts.input, path.extname(opts.input));
  const outDir = opts.out ? path.dirname(opts.out) : path.dirname(path.resolve(opts.input));
  const txtPath = opts.out || path.join(outDir, `${baseName}.txt`);

  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'transcribe-'));
  const audioPath = path.join(workDir, `${baseName}.mp3`);

  const startTime = Date.now();

  try {
    console.log('[transcribe-clip] Extracting audio…');
    await extractAudio(opts.input, audioPath, dryRun);

    // Decide whether we need to chunk based on extracted audio size.
    let chunks;
    let needsSplit = false;
    if (!dryRun) {
      const { size } = await fsp.stat(audioPath);
      needsSplit = size > MAX_UPLOAD_BYTES;
    }

    if (needsSplit) {
      console.log('[transcribe-clip] Audio exceeds upload limit - splitting into chunks…');
      const segmentDir = path.join(workDir, 'chunks');
      await fsp.mkdir(segmentDir, { recursive: true });
      chunks = await splitAudio(audioPath, segmentDir, dryRun);
    } else {
      chunks = [{ file: audioPath, offset: 0 }];
    }

    if (dryRun) {
      console.log('[transcribe-clip] Dry run complete - no transcription performed.');
      console.log(`[transcribe-clip] Would write transcript to: ${txtPath}`);
      return;
    }

    let fullText = '';
    const segments = [];
    let detectedLanguage = opts.lang || 'auto';

    for (let i = 0; i < chunks.length; i += 1) {
      const { file, offset } = chunks[i];
      if (chunks.length > 1) {
        console.log(`[transcribe-clip] Transcribing chunk ${i + 1}/${chunks.length}…`);
      } else {
        console.log('[transcribe-clip] Transcribing…');
      }

      const result = await transcribeChunk(openai, file, {
        model: opts.model,
        lang: opts.lang,
        timestamps: opts.timestamps,
      });

      const chunkText = typeof result === 'string' ? result : result.text || '';
      fullText += (fullText && chunkText ? ' ' : '') + chunkText.trim();

      if (result && result.language) {
        detectedLanguage = result.language;
      }

      if (opts.timestamps && Array.isArray(result.segments)) {
        for (const seg of result.segments) {
          segments.push({
            start: (seg.start || 0) + offset,
            end: (seg.end || 0) + offset,
            text: seg.text || '',
          });
        }
      }
    }

    await fsp.mkdir(path.dirname(txtPath), { recursive: true });
    await fsp.writeFile(txtPath, `${fullText}\n`, 'utf8');
    console.log(`[transcribe-clip] Transcript: ${txtPath}`);

    if (opts.srt) {
      const srtPath = txtPath.replace(/\.txt$/i, '') + '.srt';
      await fsp.writeFile(srtPath, buildSrt(segments), 'utf8');
      console.log(`[transcribe-clip] Subtitles: ${srtPath}`);
    }

    if (opts.json) {
      const jsonPath = txtPath.replace(/\.txt$/i, '') + '.json';
      const payload = {
        source: path.resolve(opts.input),
        model: opts.model,
        language: detectedLanguage,
        durationChunks: chunks.length,
        elapsedMs: Date.now() - startTime,
        text: fullText,
        segments,
      };
      await fsp.writeFile(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
      console.log(`[transcribe-clip] JSON: ${jsonPath}`);
    }

    console.log(
      `[transcribe-clip] Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s ` +
        `(${fullText.length} chars, language: ${detectedLanguage}).`
    );
  } finally {
    if (!opts.keepAudio) {
      await fsp.rm(workDir, { recursive: true, force: true }).catch(() => {});
    } else {
      console.log(`[transcribe-clip] Kept working audio in: ${workDir}`);
    }
  }
}

main().catch((err) => {
  console.error(`[transcribe-clip] ERROR: ${err.message}`);
  process.exit(1);
});
