import { readFileSync, unlinkSync, existsSync } from "fs";
import { execSync } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8")).version;
const zipName = `crt-overlay-chrome-extension-${version}.zip`;
const zipPath = resolve(root, zipName);
const distDir = resolve(root, "dist");

execSync("vite build --mode production", { cwd: root, stdio: "inherit" });

const strayZip = resolve(distDir, zipName);
if (existsSync(strayZip)) unlinkSync(strayZip);
if (existsSync(zipPath)) unlinkSync(zipPath);

execSync(`zip -r "${zipPath}" . -x "*.DS_Store" -x "*.zip" -x "crt.png"`, {
  cwd: distDir,
  stdio: "inherit",
});

console.log(`\nProduction package: ${zipPath}`);
