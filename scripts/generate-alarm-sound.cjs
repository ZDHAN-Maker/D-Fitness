const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "sounds");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const sampleRate = 44100;
const numChannels = 1;
const bitsPerSample = 16;

function createChimeWav() {
  const tones = [
    { freq: 587.33, dur: 0.15 }, // D5
    { freq: 880.00, dur: 0.15 }, // A5
    { freq: 1174.66, dur: 0.35 }, // D6
    { freq: 0, dur: 0.12 }, // Pause
    { freq: 587.33, dur: 0.15 }, // D5
    { freq: 880.00, dur: 0.15 }, // A5
    { freq: 1174.66, dur: 0.50 }, // D6 sustain
  ];

  const totalDur = tones.reduce((acc, t) => acc + t.dur, 0);
  const totalSamples = Math.floor(sampleRate * totalDur);
  const samples = new Int16Array(totalSamples);

  let offset = 0;
  for (const tone of tones) {
    const count = Math.floor(sampleRate * tone.dur);
    for (let i = 0; i < count; i++) {
      if (offset + i >= totalSamples) break;
      if (tone.freq === 0) {
        samples[offset + i] = 0;
      } else {
        const t = i / sampleRate;
        const envelope = Math.exp(-2.5 * (i / count)); // smooth exponential decay
        const wave = Math.sin(2 * Math.PI * tone.freq * t) + 0.25 * Math.sin(4 * Math.PI * tone.freq * t);
        const val = wave * envelope * 0.75;
        samples[offset + i] = Math.max(-32768, Math.min(32767, Math.floor(val * 32767)));
      }
    }
    offset += count;
  }

  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = totalSamples * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < totalSamples; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  const targetPath = path.join(dir, "alarm.wav");
  fs.writeFileSync(targetPath, buffer);
  console.log("Successfully generated alarm sound at " + targetPath + " (" + buffer.length + " bytes)");
}

createChimeWav();
