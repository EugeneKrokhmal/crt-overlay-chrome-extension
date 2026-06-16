import { defineConfig } from "vite";
import { resolve } from "path";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { execSync } from "child_process";
import webExtension from "vite-plugin-web-extension";
import sharp from "sharp";

const ICON_SIZES = [16, 32, 48, 128];
/** Scale of the graphic inside the icon frame (1 = fill entire icon) */
const ICON_GRAPHIC_SCALE = 0.92;

const ICON_SRC = resolve(__dirname, "icon.ico");

/** Near-white pixels connected to the image edge → transparent (keeps white inside the cassette). */
function stripEdgeWhiteBackground(data, width, height, channels, threshold = 245) {
  const out = Buffer.from(data);
  const visited = new Uint8Array(width * height);
  const queue = [];

  const isBgWhite = (pixelIndex) => {
    const i = pixelIndex * channels;
    return out[i] >= threshold && out[i + 1] >= threshold && out[i + 2] >= threshold;
  };

  const trySeed = (idx) => {
    if (visited[idx] || !isBgWhite(idx)) return;
    visited[idx] = 1;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    trySeed(x);
    trySeed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    trySeed(y * width);
    trySeed(y * width + (width - 1));
  }

  while (queue.length) {
    const idx = queue.pop();
    const i = idx * channels;
    out[i + 3] = 0;
    const x = idx % width;
    const y = (idx - x) / width;
    if (x > 0) trySeed(idx - 1);
    if (x < width - 1) trySeed(idx + 1);
    if (y > 0) trySeed(idx - width);
    if (y < height - 1) trySeed(idx + width);
  }

  return out;
}

async function loadTransparentIconSource(srcPath) {
  let inputBuffer;
  if (srcPath.endsWith(".ico")) {
    inputBuffer = execSync(`magick "${srcPath}"[0] png:-`);
  } else {
    inputBuffer = readFileSync(srcPath);
  }
  const { data, info } = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cleaned = stripEdgeWhiteBackground(data, info.width, info.height, info.channels);
  return sharp(cleaned, { raw: info }).png().toBuffer();
}

/** Build icons on a transparent canvas from a source PNG with white background removed. */
async function buildIcons(srcPath, iconsDir) {
  const sourcePng = await loadTransparentIconSource(srcPath);
  const scale = ICON_GRAPHIC_SCALE;

  for (const size of ICON_SIZES) {
    const outPath = resolve(iconsDir, `icon${size}.png`);
    const graphicSize = Math.max(1, Math.round(size * scale));
    const graphic = await sharp(sourcePng).resize(graphicSize, graphicSize).png().toBuffer();
    const left = Math.floor((size - graphicSize) / 2);
    const top = Math.floor((size - graphicSize) / 2);
    await sharp({
      create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: graphic, left, top }])
      .png()
      .toFile(outPath);
  }
}

function copyIconPlugin() {
  return {
    name: "copy-crt-icon",
    async closeBundle() {
      if (!existsSync(ICON_SRC)) return;
      const iconsDir = resolve(__dirname, "dist", "icons");
      mkdirSync(iconsDir, { recursive: true });
      await buildIcons(ICON_SRC, iconsDir);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [webExtension(), copyIconPlugin()],
  build: {
    minify: "esbuild",
    sourcemap: false,
    emptyOutDir: true,
    target: "esnext",
  },
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));
