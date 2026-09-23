// Genera iconos PNG solidos simples (placeholder) para el manifest de la PWA.
// La supervisora puede reemplazar public/icon-192.png y public/icon-512.png
// mas adelante por un logo real del mismo tamano.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import path from "node:path";

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(tipo, data) {
  const tipoBuf = Buffer.from(tipo, "ascii");
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tipoBuf, data])), 0);
  return Buffer.concat([largo, tipoBuf, data, crcBuf]);
}

function generarPng(size, [r, g, b]) {
  const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const filaCruda = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const inicio = y * (size * 3 + 1);
    filaCruda[inicio] = 0; // sin filtro
    for (let x = 0; x < size; x++) {
      const p = inicio + 1 + x * 3;
      filaCruda[p] = r;
      filaCruda[p + 1] = g;
      filaCruda[p + 2] = b;
    }
  }

  const idatData = deflateSync(filaCruda);

  return Buffer.concat([
    firma,
    chunk("IHDR", ihdr),
    chunk("IDAT", idatData),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = path.join(process.cwd(), "public");
const verde = [25, 107, 36]; // #196B24, mismo verde de la app/legend

writeFileSync(path.join(outDir, "icon-192.png"), generarPng(192, verde));
writeFileSync(path.join(outDir, "icon-512.png"), generarPng(512, verde));

console.log("Iconos generados en public/icon-192.png y public/icon-512.png");
