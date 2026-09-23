# Control de Asistencia - Deliasesoras

App para que la supervisora capture las marcas de entrada/salida (a partir de
una foto del gafete + reloj biometrico), lleve el calendario mensual de
asistencia y descargue dos Excel: el calendario (identico en formato/colores
al original) y una bitacora de marcas con anomalias.

## 1. Crear el proyecto de Supabase (gratis)

1. Entra a https://supabase.com, crea una cuenta y un nuevo proyecto (elige
   una region cercana, ej. `us-east-1`). Anota la contrasena de la base de
   datos que te pida (no se usa aqui, pero guardala).
2. Cuando el proyecto termine de aprovisionar, ve a **SQL Editor > New query**,
   pega todo el contenido de [`lib/schema.sql`](lib/schema.sql) y dale **Run**.
   Esto crea las tablas `asesoras`, `marcas`, `dias_especiales` y `configuracion`.
3. Ve a **Storage > New bucket**, nombralo `marcas-fotos`, dejalo **privado**
   (Public: apagado) y crea.
4. Ve a **Project Settings > API**. Copia:
   - `Project URL` -> sera `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key -> sera `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (boton "Reveal") -> sera `SUPABASE_SERVICE_ROLE_KEY`
     (esta es secreta, nunca la compartas ni la subas a git).

## 2. Crear la API key de Google Gemini (gratis, para leer las fotos)

1. Entra a https://aistudio.google.com/apikey con tu cuenta de Google.
2. Boton **Create API key** > elige o crea un proyecto de Google Cloud >
   copia la key generada.
3. La capa gratuita de Gemini alcanza sobradamente para el volumen de fotos
   de este uso (unas pocas por asesora al dia); no hace falta tarjeta ni
   configurar facturacion para empezar.

## 3. Configurar el proyecto localmente

1. Copia `.env.local.example` a `.env.local`:
   ```
   cp .env.local.example .env.local
   ```
2. Pega en `.env.local` los 3 valores de Supabase y la API key de Gemini.
3. Instala dependencias (si no lo hiciste ya):
   ```
   npm install
   ```
4. Importa el catalogo de asesoras/puntos desde el Excel original (una sola vez):
   ```
   npm run importar-catalogo
   ```
5. Corre la app en local:
   ```
   npm run dev
   ```
   Abre http://localhost:3000

## 4. Publicar en Vercel

1. Sube este proyecto a un repositorio de GitHub.
2. Entra a https://vercel.com, **Add New Project**, importa el repo.
3. En **Environment Variables** agrega las mismas 4 variables de `.env.local`.
4. Deploy. Cuando termine, tendras una URL publica (ej. `https://tu-app.vercel.app`).

## 5. Instalar como app en el Samsung A26

1. Abre la URL de Vercel en **Chrome** en el celular.
2. Toca el menu (⋮) > **Agregar a pantalla de inicio** (o aparecera un banner
   "Instalar app" automaticamente).
3. Confirma. Quedara un icono como cualquier app, abre en pantalla completa.

## 6. Uso diario

- **Capturar**: subir la foto -> la IA sugiere nombre/fecha/hora -> confirmas
  o corriges -> guardar. Si falta la marca contraria del dia, aparece un
  pop-up de aviso inmediato.
- **Calendario**: click en un dia para marcar Ausencia/Incapacidad/Libre/
  Vacaciones (Asistencia se marca sola cuando hay entrada+salida el mismo dia).
  Boton para descargar el Excel de asistencia del mes.
- **Bitacora**: lista de anomalias (marcas faltantes, horas insuficientes) y
  boton para descargar el Excel de bitacora del mes.
- **Asesoras**: agregar nuevas, reubicar de punto, dar de baja o eliminar.

Todo lo capturado/editado se guarda de inmediato en Supabase: no depende del
celular ni del navegador, asi que nunca se pierde entre dias aunque cambies de
telefono o cierres la app.
