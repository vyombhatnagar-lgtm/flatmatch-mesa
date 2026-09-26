// Generates simple illustrative SVG building images for mock listings.
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("public/listings", { recursive: true });
const palettes = [
  ["#dbe7e4", "#2f6f62", "#f4efe6"], ["#e6e0f2", "#5b4b8a", "#f7f3ea"], ["#f3e3d3", "#9a5b2e", "#f8f4ee"],
  ["#dde6f0", "#34597f", "#f5f2ec"], ["#e9e4d8", "#6b6443", "#f7f5ef"], ["#f0dede", "#8a3f45", "#f8f3f0"],
  ["#dfeadf", "#3f6b45", "#f4f1e9"], ["#e3e8ec", "#44525e", "#f6f4ef"],
];
palettes.forEach(([sky, bld, win], i) => {
  const floors = 5 + (i % 4) * 2, w = 150 + (i % 3) * 20, x = (400 - w) / 2, h = floors * 22 + 20, y = 240 - h;
  let windows = "";
  for (let f = 0; f < floors; f++) for (let c = 0; c < 4; c++) {
    windows += `<rect x="${x + 16 + c * ((w - 32) / 4)}" y="${y + 14 + f * 22}" width="${(w - 32) / 4 - 10}" height="12" rx="2" fill="${win}" opacity="${(f + c + i) % 3 ? 0.95 : 0.55}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" role="img" aria-label="Illustration of an apartment building"><rect width="400" height="260" fill="${sky}"/><circle cx="${60 + i * 35}" cy="55" r="22" fill="${win}" opacity="0.8"/><rect x="0" y="238" width="400" height="22" fill="${bld}" opacity="0.25"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${bld}"/>${windows}<rect x="${x + w / 2 - 12}" y="${240 - 22}" width="24" height="22" fill="${win}"/><rect x="${x - 60}" y="${240 - 70}" width="50" height="70" rx="3" fill="${bld}" opacity="0.45"/><rect x="${x + w + 10}" y="${240 - 95}" width="55" height="95" rx="3" fill="${bld}" opacity="0.35"/></svg>`;
  writeFileSync(`public/listings/flat-${i + 1}.svg`, svg);
});
console.log("wrote 8 images");
