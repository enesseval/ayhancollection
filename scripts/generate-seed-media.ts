// Demo ürün görsellerini üretir (gerçek fotoğraflar gelene kadar yer tutucu illüstrasyonlar).
// Görseller, gerçek yüklemelerle AYNI boru hattından geçer: 4:5 kırpma, 4 boyut WebP, ThumbHash.
// Çalıştırma: node scripts/generate-seed-media.ts
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { productDefs, type Art, type Pattern, type ProductDef } from "../src/lib/seed/catalog.ts";
import { processImage } from "../src/lib/media/process.ts";

const OUT = path.resolve("public/media/seed");
const W = 1600;
const H = 2000;

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

function patternDef(id: string, pattern: Pattern, base: string, accent: string, scale = 1) {
  const s = (n: number) => n * scale;
  const light = luminance(base) > 0.6;
  const ink = light ? shade(base, -70) : shade(base, 55);
  switch (pattern) {
    case "paisley":
      return `<pattern id="${id}" width="${s(220)}" height="${s(220)}" patternUnits="userSpaceOnUse">
        <rect width="${s(220)}" height="${s(220)}" fill="${base}"/>
        <path d="M${s(60)} ${s(150)} C ${s(10)} ${s(100)}, ${s(60)} ${s(20)}, ${s(110)} ${s(60)} C ${s(150)} ${s(90)}, ${s(120)} ${s(150)}, ${s(60)} ${s(150)} Z" fill="${accent}" opacity="0.85"/>
        <circle cx="${s(85)}" cy="${s(95)}" r="${s(14)}" fill="${base}"/>
        <circle cx="${s(170)}" cy="${s(180)}" r="${s(18)}" fill="none" stroke="${accent}" stroke-width="${s(5)}"/>
        <circle cx="${s(170)}" cy="${s(30)}" r="${s(6)}" fill="${accent}"/>
      </pattern>`;
    case "medallion":
      return `<pattern id="${id}" width="${s(260)}" height="${s(260)}" patternUnits="userSpaceOnUse">
        <rect width="${s(260)}" height="${s(260)}" fill="${base}"/>
        <circle cx="${s(130)}" cy="${s(130)}" r="${s(90)}" fill="none" stroke="${accent}" stroke-width="${s(10)}"/>
        <circle cx="${s(130)}" cy="${s(130)}" r="${s(55)}" fill="${accent}" opacity="0.6"/>
        <path d="M${s(130)} ${s(60)} L ${s(150)} ${s(130)} L ${s(130)} ${s(200)} L ${s(110)} ${s(130)} Z" fill="${shade(base, -30)}"/>
        <circle cx="${s(0)}" cy="${s(0)}" r="${s(30)}" fill="${accent}" opacity="0.5"/>
        <circle cx="${s(260)}" cy="${s(260)}" r="${s(30)}" fill="${accent}" opacity="0.5"/>
      </pattern>`;
    case "waves":
      return `<pattern id="${id}" width="${s(240)}" height="${s(90)}" patternUnits="userSpaceOnUse">
        <rect width="${s(240)}" height="${s(90)}" fill="${base}"/>
        <path d="M0 ${s(45)} C ${s(60)} 0, ${s(120)} ${s(90)}, ${s(180)} ${s(45)} S ${s(240)} 0, ${s(240)} ${s(45)}" fill="none" stroke="${accent}" stroke-width="${s(14)}" opacity="0.8"/>
        <path d="M0 ${s(75)} C ${s(60)} ${s(30)}, ${s(120)} ${s(120)}, ${s(180)} ${s(75)}" fill="none" stroke="${ink}" stroke-width="${s(4)}" opacity="0.5"/>
      </pattern>`;
    case "zebra":
      return `<pattern id="${id}" width="${s(200)}" height="${s(200)}" patternUnits="userSpaceOnUse">
        <rect width="${s(200)}" height="${s(200)}" fill="${accent}"/>
        <path d="M0 ${s(20)} Q ${s(60)} ${s(50)} ${s(120)} ${s(10)} T ${s(200)} ${s(30)} L ${s(200)} ${s(55)} Q ${s(140)} ${s(40)} ${s(90)} ${s(70)} T 0 ${s(50)} Z" fill="${base}"/>
        <path d="M0 ${s(110)} Q ${s(80)} ${s(140)} ${s(140)} ${s(100)} T ${s(200)} ${s(120)} L ${s(200)} ${s(140)} Q ${s(120)} ${s(130)} ${s(70)} ${s(160)} T 0 ${s(135)} Z" fill="${base}"/>
        <path d="M0 ${s(175)} Q ${s(50)} ${s(195)} ${s(110)} ${s(170)} T ${s(200)} ${s(185)} L ${s(200)} ${s(200)} L 0 ${s(200)} Z" fill="${base}"/>
      </pattern>`;
    case "floral":
      return `<pattern id="${id}" width="${s(140)}" height="${s(140)}" patternUnits="userSpaceOnUse">
        <rect width="${s(140)}" height="${s(140)}" fill="${base}"/>
        ${[0, 72, 144, 216, 288]
          .map(
            (a) =>
              `<ellipse cx="${s(40)}" cy="${s(26)}" rx="${s(9)}" ry="${s(16)}" fill="${accent}" transform="rotate(${a} ${s(40)} ${s(40)})"/>`,
          )
          .join("")}
        <circle cx="${s(40)}" cy="${s(40)}" r="${s(7)}" fill="${ink}"/>
        <path d="M${s(95)} ${s(110)} q ${s(15)} ${s(-25)} ${s(30)} 0" stroke="${ink}" stroke-width="${s(4)}" fill="none" opacity="0.6"/>
        <ellipse cx="${s(110)}" cy="${s(95)}" rx="${s(6)}" ry="${s(12)}" fill="${shade(accent, -30)}" opacity="0.7"/>
      </pattern>`;
    case "dots":
      return `<pattern id="${id}" width="${s(70)}" height="${s(70)}" patternUnits="userSpaceOnUse">
        <rect width="${s(70)}" height="${s(70)}" fill="${base}"/>
        <path d="M${s(18)} ${s(18)} l ${s(6)} ${s(12)} l ${s(-12)} 0 z" fill="${accent}"/>
        <circle cx="${s(53)}" cy="${s(52)}" r="${s(3)}" fill="${accent}"/>
      </pattern>`;
    case "stripes":
      return `<pattern id="${id}" width="${s(60)}" height="${s(60)}" patternUnits="userSpaceOnUse">
        <rect width="${s(60)}" height="${s(60)}" fill="${accent}"/>
        <rect x="${s(4)}" width="${s(10)}" height="${s(60)}" fill="${shade(accent, 40)}"/>
        <rect x="${s(30)}" width="${s(3)}" height="${s(60)}" fill="${shade(accent, 25)}"/>
      </pattern>`;
    case "batik":
      return `<pattern id="${id}" width="${s(300)}" height="${s(300)}" patternUnits="userSpaceOnUse">
        <rect width="${s(300)}" height="${s(300)}" fill="${base}"/>
        <circle cx="${s(70)}" cy="${s(80)}" r="${s(60)}" fill="${accent}" opacity="0.35"/>
        <circle cx="${s(220)}" cy="${s(200)}" r="${s(80)}" fill="${accent}" opacity="0.25"/>
        <circle cx="${s(200)}" cy="${s(60)}" r="${s(30)}" fill="${ink}" opacity="0.2"/>
        <path d="M0 ${s(260)} C ${s(80)} ${s(220)}, ${s(160)} ${s(300)}, ${s(300)} ${s(250)}" stroke="${accent}" stroke-width="${s(18)}" fill="none" opacity="0.3"/>
      </pattern>`;
    case "pleats":
      return `<pattern id="${id}" width="${s(46)}" height="${s(46)}" patternUnits="userSpaceOnUse">
        <rect width="${s(46)}" height="${s(46)}" fill="${base}"/>
        <rect x="${s(20)}" width="${s(6)}" height="${s(46)}" fill="${shade(base, -18)}"/>
        <rect x="${s(26)}" width="${s(4)}" height="${s(46)}" fill="${shade(base, 22)}"/>
      </pattern>`;
    default:
      return `<pattern id="${id}" width="${s(12)}" height="${s(12)}" patternUnits="userSpaceOnUse">
        <rect width="${s(12)}" height="${s(12)}" fill="${base}"/>
        <rect width="${s(12)}" height="${s(1)}" fill="${shade(base, luminance(base) > 0.5 ? -6 : 6)}"/>
      </pattern>`;
  }
}

function garment(art: Art, accent: string): string {
  // Tüm şekiller fill="url(#fab)" ile çizilir; ikincil parçalar accent rengi
  const body = 'fill="url(#fab)" stroke="rgba(0,0,0,0.12)" stroke-width="4"';
  const sec = `fill="${accent}" stroke="rgba(0,0,0,0.10)" stroke-width="4"`;
  switch (art) {
    case "tunic":
      return `<path ${body} d="M800 330 C 730 330 690 350 660 370 L 520 420 C 450 450 420 520 400 600 L 330 980 L 450 1010 L 540 700 L 520 1620 C 700 1660 900 1660 1080 1620 L 1060 700 L 1150 1010 L 1270 980 L 1200 600 C 1180 520 1150 450 1080 420 L 940 370 C 910 350 870 330 800 330 Z"/>
        <path d="M720 345 Q 800 430 880 345" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="10"/>`;
    case "dress":
      return `<path ${body} d="M800 300 C 730 300 690 320 660 340 L 540 390 C 470 420 440 490 420 570 L 350 960 L 470 990 L 560 680 L 470 1820 C 680 1880 920 1880 1130 1820 L 1040 680 L 1130 990 L 1250 960 L 1180 570 C 1160 490 1130 420 1060 390 L 940 340 C 910 320 870 300 800 300 Z"/>
        <rect x="552" y="900" width="496" height="44" rx="10" fill="#6B4E37"/>`;
    case "skirt":
      return `<path ${body} d="M590 420 L 1010 420 L 1180 1720 C 940 1770 660 1770 420 1720 Z"/>
        <rect x="580" y="380" width="440" height="80" rx="16" ${sec}/>
        <line x1="800" y1="460" x2="800" y2="1755" stroke="#C9C9C9" stroke-width="10"/>`;
    case "vest":
      return `<path ${sec} d="M800 330 C 730 330 690 350 660 370 L 520 420 C 450 450 420 520 400 600 L 330 980 L 450 1010 L 540 700 L 540 1500 L 1060 1500 L 1060 700 L 1150 1010 L 1270 980 L 1200 600 C 1180 520 1150 450 1080 420 L 940 370 C 910 350 870 330 800 330 Z"/>
        <path ${body} d="M560 410 L 760 400 L 770 1700 L 520 1720 C 520 1720 500 800 560 410 Z"/>
        <path ${body} d="M1040 410 L 840 400 L 830 1700 L 1080 1720 C 1080 1720 1100 800 1040 410 Z"/>
        <path d="M540 1500 q 30 40 60 0 q 30 40 60 0 q 30 40 60 0 q 30 40 60 0 q 30 40 60 0 q 30 40 60 0 q 30 40 60 0 q 30 40 60 0 q 30 40 60 0" fill="none" stroke="${accent}" stroke-width="16"/>`;
    case "set":
      return `<path ${body} d="M800 300 C 730 300 690 320 660 340 L 520 390 C 450 420 420 490 400 570 L 330 950 L 450 980 L 540 670 L 530 1150 L 1070 1150 L 1060 670 L 1150 980 L 1270 950 L 1200 570 C 1180 490 1150 420 1080 390 L 940 340 C 910 320 870 300 800 300 Z"/>
        <path fill="${accent}" stroke="rgba(0,0,0,0.1)" stroke-width="4" d="M570 1160 L 1030 1160 L 1130 1840 C 920 1880 680 1880 470 1840 Z"/>`;
    case "knit":
      return `<path ${body} d="M800 330 C 730 330 690 350 660 370 L 520 420 C 450 450 420 520 400 600 L 330 980 L 450 1010 L 540 700 L 530 1560 L 1070 1560 L 1060 700 L 1150 1010 L 1270 980 L 1200 600 C 1180 520 1150 450 1080 420 L 940 370 C 910 350 870 330 800 330 Z"/>
        <rect x="525" y="1500" width="550" height="90" fill="${accent}" opacity="0.9"/>
        <path d="M330 980 L 450 1010 L 440 1060 L 320 1030 Z" fill="${accent}"/>
        <path d="M1270 980 L 1150 1010 L 1160 1060 L 1280 1030 Z" fill="${accent}"/>
        ${Array.from({ length: 22 }, (_, i) => `<line x1="${535 + i * 25}" y1="1505" x2="${535 + i * 25}" y2="1585" stroke="rgba(0,0,0,0.18)" stroke-width="5"/>`).join("")}`;
    case "scarf":
      return `<g transform="rotate(45 800 1000)">
          <rect x="350" y="550" width="900" height="900" ${body}/>
          <rect x="390" y="590" width="820" height="820" fill="none" stroke="${accent}" stroke-width="22"/>
          <rect x="430" y="630" width="740" height="740" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="6"/>
        </g>`;
    case "pajama":
      return `<path ${body} d="M800 260 C 740 260 700 270 670 290 L 540 330 C 470 360 440 420 420 500 L 360 820 L 480 850 L 550 610 L 550 1060 L 1050 1060 L 1050 610 L 1120 850 L 1240 820 L 1180 500 C 1160 420 1130 360 1060 330 L 930 290 C 900 270 860 260 800 260 Z"/>
        <path d="M760 280 L 800 360 L 840 280" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="10"/>
        ${[480, 600, 720, 840, 960].map((y) => `<circle cx="800" cy="${y}" r="10" fill="rgba(255,255,255,0.55)"/>`).join("")}
        <path fill="url(#fab2)" stroke="rgba(0,0,0,0.12)" stroke-width="4" d="M580 1100 L 1020 1100 L 1060 1880 L 870 1880 L 800 1300 L 730 1880 L 540 1880 Z"/>`;
    case "tshirt":
      return `<path ${body} d="M800 420 C 730 420 690 440 660 460 L 470 520 L 330 760 L 500 840 L 560 740 L 560 1560 L 1040 1560 L 1040 740 L 1100 840 L 1270 760 L 1130 520 L 940 460 C 910 440 870 420 800 420 Z"/>
        <path d="M330 760 L 500 840 L 490 860 L 320 780 Z" fill="${accent}"/>
        <path d="M1270 760 L 1100 840 L 1110 860 L 1280 780 Z" fill="${accent}"/>
        <path d="M700 450 Q 800 540 900 450" fill="none" stroke="${accent}" stroke-width="14"/>`;
  }
}

function productSvg(def: ProductDef, colorHex: string, variant: "full" | "detail") {
  const accent = def.accent ?? shade(colorHex, 40);
  const bgTop = "#F4EFE9";
  const bgBottom = "#E8DFD5";
  const pajamaBottom = def.art === "pajama" && def.pattern !== "plain";
  const topPattern: Pattern = def.art === "pajama" && (def.pattern === "stripes" || def.slug.includes("mint")) ? "plain" : def.pattern;
  const defs = `
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bgTop}"/><stop offset="1" stop-color="${bgBottom}"/></linearGradient>
    <linearGradient id="light" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="0.16"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.10"/>
      <stop offset="0.7" stop-color="#000" stop-opacity="0.04"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/>
    </linearGradient>
    ${patternDef("fab", topPattern, colorHex, accent, variant === "detail" ? 2.4 : 1)}
    ${patternDef("fab2", pajamaBottom ? def.pattern : "plain", pajamaBottom ? shade(accent, 0) : colorHex, colorHex, 1)}`;

  if (variant === "detail") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>${defs}</defs>
      <rect width="${W}" height="${H}" fill="url(#fab)"/>
      <path d="M0 0 C 500 400 300 1200 900 2000 L 0 2000 Z" fill="#000" opacity="0.06"/>
      <path d="M1600 0 C 1100 600 1500 1300 1000 2000 L 1600 2000 Z" fill="#fff" opacity="0.07"/>
      <rect width="${W}" height="${H}" fill="url(#light)" opacity="0.6"/>
    </svg>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>${defs}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <ellipse cx="800" cy="1900" rx="560" ry="40" fill="#000" opacity="0.06"/>
    <g>${garment(def.art, accent)}</g>
    <g style="mix-blend-mode:multiply" opacity="0.5">${garment(def.art, accent).replace(/fill="url\(#fab2?\)"/g, 'fill="url(#light)"').replace(/fill="#[0-9A-Fa-f]{6}"/g, 'fill="url(#light)"')}</g>
  </svg>`;
}

async function main() {
  await rm(OUT, { recursive: true, force: true });
  const manifest: Record<string, unknown[]> = {};
  let total = 0;
  for (const def of productDefs) {
    const dir = path.join(OUT, def.slug);
    await mkdir(dir, { recursive: true });
    const items: { name: string; svg: string; alt: string; color: string | null }[] = [];
    def.colors.forEach((c, i) =>
      items.push({ name: String(i + 1), svg: productSvg(def, c.hex, "full"), alt: `${def.name} - ${c.name}`, color: c.name }),
    );
    items.push({
      name: "detay",
      svg: productSvg(def, def.colors[0].hex, "detail"),
      alt: `${def.name} kumaş detayı`,
      color: null,
    });
    manifest[def.slug] = [];
    for (const it of items) {
      const processed = await processImage(Buffer.from(it.svg), { focalX: 0.5, focalY: 0.5 });
      for (const f of processed.files) {
        await writeFile(path.join(dir, `${it.name}-${f.width}.webp`), f.buffer);
        total += f.buffer.length;
      }
      manifest[def.slug].push({
        key: `seed/${def.slug}/${it.name}`,
        width: processed.width,
        height: processed.height,
        thumbhash: processed.thumbhash,
        alt: it.alt,
        color: it.color,
      });
    }
    process.stdout.write(".");
  }
  const ts = `// Otomatik üretildi: node scripts/generate-seed-media.ts
import type { Media } from "../types.ts";
export const seedMedia: Record<string, Media[]> = ${JSON.stringify(manifest, null, 2)};
`;
  await writeFile(path.resolve("src/lib/seed/media-manifest.ts"), ts);
  console.log(`\n${productDefs.length} ürün, toplam ${(total / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
