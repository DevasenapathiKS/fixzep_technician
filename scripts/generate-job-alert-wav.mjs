/**
 * One-shot: generates a short bundled notification tone (PCM WAV).
 * Run: node scripts/generate-job-alert-wav.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../assets/sounds');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'job_alert.wav');

const sampleRate = 22050;
const duration = 0.28;
const freq = 880;
const numSamples = Math.floor(sampleRate * duration);
const dataSize = numSamples * 2;
const buf = Buffer.alloc(44 + dataSize);

buf.write('RIFF', 0);
buf.writeUInt32LE(36 + dataSize, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(sampleRate, 24);
buf.writeUInt32LE(sampleRate * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(dataSize, 40);

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const env = Math.min(1, i / 400) * Math.min(1, (numSamples - i) / 800);
  const s = Math.sin(2 * Math.PI * freq * t) * 0.4 * env * 32767;
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(s))), 44 + i * 2);
}

fs.writeFileSync(outPath, buf);
console.log('Wrote', outPath, buf.length, 'bytes');
