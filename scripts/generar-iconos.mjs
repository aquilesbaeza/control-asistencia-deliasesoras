// Genera los iconos PWA a partir del logo real de TRIXO, sin marco blanco:
// - icon-192.png / icon-512.png: el logo recortado, gris de borde a borde.
// - icon-maskable-512.png: fondo gris completo con el logo dentro de la zona segura,
//   para que Android (Samsung) no le agregue un fondo blanco ni lo recorte.
import sharp from "sharp";
import path from "path";

const LOGO = path.join(process.cwd(), "assets-ejemplos", "logo-gris-cuadrado.png");

// 1) Quita el marco blanco del archivo original.
const primerRecorte = await sharp(LOGO).trim({ threshold: 25 }).toBuffer({ resolveWithObject: true });
// Recorta unos pixeles mas hacia adentro para eliminar la linea tenue del borde original.
const MARGEN = 10;
const recortado = await sharp(primerRecorte.data)
  .extract({
    left: MARGEN,
    top: MARGEN,
    width: primerRecorte.info.width - MARGEN * 2,
    height: primerRecorte.info.height - MARGEN * 2,
  })
  .toBuffer({ resolveWithObject: true });
const { width, height } = recortado.info;
console.log(`Logo recortado: ${width}x${height}`);

// 2) Gris real del logo (pixel de una esquina ya recortada).
const [r, g, b] = await sharp(recortado.data)
  .extract({ left: 3, top: 3, width: 1, height: 1 })
  .raw()
  .toBuffer();
const fondo = { r, g, b, alpha: 1 };
console.log(`Gris del logo: rgb(${r}, ${g}, ${b})`);

// 3) Iconos normales: cuadrados, gris de borde a borde.
for (const size of [192, 512]) {
  await sharp(recortado.data)
    .resize(size, size, { fit: "cover" })
    .flatten({ background: fondo })
    .png()
    .toFile(`public/icon-${size}.png`);
}

// 4) Maskable: lienzo gris completo, logo al 66 % (zona segura del 80 %).
const lado = 512;
const interior = Math.round(lado * 0.66);
const logoInterior = await sharp(recortado.data).resize(interior, interior, { fit: "cover" }).toBuffer();
await sharp({ create: { width: lado, height: lado, channels: 4, background: fondo } })
  .composite([{ input: logoInterior, gravity: "center" }])
  .png()
  .toFile("public/icon-maskable-512.png");

console.log("Iconos generados: icon-192, icon-512, icon-maskable-512");
