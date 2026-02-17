import { defineConfig } from "vite";
import { resolve } from "path";
import { existsSync, mkdirSync } from "fs";
import webExtension from "vite-plugin-web-extension";
import sharp from "sharp";

const ICON_SIZES = [16, 32, 48, 128];
/** Scale of the graphic inside the icon frame (1 = fill entire icon) */
const ICON_GRAPHIC_SCALE = 1.2;

/** Build icons. Scale >1 = zoom into center (crop); scale <=1 = graphic on transparent canvas. */
async function buildIcons(srcPath, iconsDir) {
  const scale = ICON_GRAPHIC_SCALE;
  for (const size of ICON_SIZES) {
    const outPath = resolve(iconsDir, `icon${size}.png`);
    if (scale >= 1) {
      const big = Math.max(1, Math.round(size * scale));
      const offset = Math.floor((big - size) / 2);
      await sharp(srcPath)
        .resize(big, big)
        .extract({ left: offset, top: offset, width: size, height: size })
        .png()
        .toFile(outPath);
    } else {
      const graphicSize = Math.max(1, Math.round(size * scale));
      const graphic = await sharp(srcPath).resize(graphicSize, graphicSize).png().toBuffer();
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
}

function copyIconPlugin() {
  return {
    name: "copy-crt-icon",
    async closeBundle() {
      const src = resolve(__dirname, "..", "crt.png");
      if (!existsSync(src)) return;
      const iconsDir = resolve(__dirname, "dist", "icons");
      mkdirSync(iconsDir, { recursive: true });
      await buildIcons(src, iconsDir);
    },
  };
}

export default defineConfig({
  plugins: [webExtension(), copyIconPlugin()],
  build: {
    minify: true,
    sourcemap: false,
  },
});
