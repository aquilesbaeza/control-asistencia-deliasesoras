// Genera los iconos PWA (cuadrados, fondo gris de marca) a partir del logo
// real de TRIXO (assets-ejemplos/logo-gris.png), para instalar la app como
// "Control" en Android con su icono oficial.
import sharp from "sharp";
import path from "path";

const LOGO = path.join(process.cwd(), "assets-ejemplos", "logo-gris-cuadrado.png");

async function generar(size, outPath) {
  await sharp(LOGO).resize(size, size).png().toFile(outPath);
}

await generar(192, "public/icon-192.png");
await generar(512, "public/icon-512.png");
console.log("Iconos generados con el logo TRIXO real.");
