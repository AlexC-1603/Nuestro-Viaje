# 🧭 Nuestro Mapa

Una bitácora de viaje privada para dos personas: guarden los lugares que
quieren visitar, márquenlos como visitados con la fecha, suban sus fotos,
y vean en tiempo real cuánto tiempo llevan juntos.

No necesita servidor propio ni tarjeta de crédito: usa **Firebase**
(gratis, sin tarjeta) para el login y la base de datos de lugares,
**Cloudinary** (gratis, sin tarjeta, hasta 25 GB) para guardar las fotos,
y se publica gratis con **GitHub Pages**.

> Nota: Firebase Storage (el almacenamiento de archivos de Firebase) desde
> 2024 exige activar el plan de pago Blaze aunque el uso se mantenga en
> $0. Por eso las fotos van a Cloudinary en vez de a Firebase.

---

## 1. Crear el proyecto de Firebase

1. Entra a [console.firebase.google.com](https://console.firebase.google.com) con una cuenta de Google (puede ser la de cualquiera de los dos).
2. **Crear un proyecto** → ponle un nombre (ej. `nuestro-mapa`) → puedes desactivar Google Analytics, no hace falta.
3. Cuando el proyecto esté listo, en la página principal haz clic en el ícono **`</>`** ("Web") para registrar una app web.
   - Nombre de la app: lo que quieras.
   - **No** marques "Firebase Hosting" (usaremos GitHub Pages).
4. Firebase te mostrará un bloque de código con `const firebaseConfig = {...}`. **Cópialo**.
5. Abre el archivo `js/firebase-config.js` de este proyecto y reemplaza el objeto `firebaseConfig` con el que copiaste.

## 2. Activar Authentication (login)

1. Menú lateral izquierdo → **Build > Authentication** → **Get started**.
2. Pestaña **Sign-in method** → habilita **Correo electrónico/contraseña**.
3. Eso es todo: cada uno de ustedes creará su cuenta directamente desde la app, con el botón "¿Primera vez? Crear una cuenta" (no hace falta crearlas manualmente).

## 3. Activar Firestore (base de datos de lugares)

1. Menú lateral → **Build > Firestore Database** → **Create database**.
2. Elige la ubicación más cercana (ej. `southamerica-east1`) → modo **producción**.
3. Ve a la pestaña **Rules** y reemplaza el contenido con esto, luego **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Cada quien solo puede leer y escribir su propio documento de usuario
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    match /couples/{code} {
      // Cualquiera con sesión iniciada puede consultar si un código existe
      // (necesario para poder unirse con un código).
      allow get: if request.auth != null;

      // Crear un código nuevo: solo con un único miembro, que debe ser
      // exactamente quien está escribiendo.
      allow create: if request.auth != null
        && request.resource.data.memberUids.size() == 1
        && request.resource.data.memberUids[0] == request.auth.uid;

      // Unirse con un código existente: solo si actualmente tiene 1
      // miembro y pasa a tener 2, y quien escribe queda incluido.
      allow update: if request.auth != null
        && resource.data.memberUids.size() == 1
        && request.resource.data.memberUids.size() == 2
        && request.auth.uid in request.resource.data.memberUids;

      allow delete: if false;

      // Lugares y configuración de esa pareja: solo sus dos miembros
      match /{document=**} {
        allow read, write: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/couples/$(code)).data.memberUids;
      }
    }
  }
}
```

Esto es lo que hace la app realmente privada: **nadie necesita saber sus
correos ni ustedes tienen que escribirlos en ningún archivo público de
GitHub.** La barrera es el código de 6 caracteres que se comparten en
privado (por WhatsApp, por ejemplo) — una vez que dos cuentas quedan
enlazadas a ese código, un tercero no puede leer ni escribir nada aunque
cree su propia cuenta, porque su UID nunca estará en `memberUids`.

## 4. Crear cuenta en Cloudinary (fotos)

Aquí es donde se guardan las fotos — gratis, sin pedir tarjeta.

1. Entra a [cloudinary.com/users/register/free](https://cloudinary.com/users/register/free) y crea una cuenta gratis.
2. En el **Dashboard** (la página que ves al entrar) copia tu **Cloud name** — aparece arriba, es un texto corto tipo `dxyzabc12`.
3. Ve a **Settings** (ícono de engranaje, arriba a la derecha) → pestaña **Upload** → sección **Upload presets** → **Add upload preset**.
4. En "Signing Mode" cámbialo de "Signed" a **"Unsigned"** (esto es lo que permite subir fotos desde la app sin exponer tu contraseña). Guarda.
5. Copia el nombre del preset que se generó (algo como `abc12de3`).
6. Abre `js/firebase-config.js` y reemplaza `cloudName` y `uploadPreset` con esos dos valores.

Con el plan gratuito de Cloudinary tienen 25 GB de almacenamiento y 25 GB
de transferencia al mes — de sobra para fotos de viajes de dos personas.

> Limitación a tener en cuenta: al eliminar un lugar desde la app, se borra
> el registro y ya no verán las fotos ahí, pero los archivos siguen
> existiendo en tu cuenta de Cloudinary (borrarlos requiere una llamada
> firmada que no es segura hacer desde el navegador). Si alguna vez quieren
> liberar espacio, pueden borrarlas manualmente desde el Media Library de
> Cloudinary — muy poco probable que lo necesiten con 25 GB disponibles.

## 5. Probar en tu computadora (opcional)

Antes de subirlo, puedes abrir `index.html` directamente en el navegador para
probar. Algunos navegadores bloquean módulos locales; si ves errores raros,
usa una extensión como "Live Server" de VS Code, o salta directo al paso 6.

## 6. Subir a GitHub

1. Crea un repositorio nuevo en GitHub (puede ser privado, recomendado ya que
   es algo personal — aunque igual los datos reales viven en Firebase, no en el código).
2. Sube estos archivos y carpetas tal cual están: `index.html`, `styles.css`, la carpeta `js/` completa (con tu `firebase-config.js` ya editado), y este `README.md`.
   - Desde la web de GitHub: botón **Add file > Upload files**, arrastra todo, y confirma el commit.

## 7. Publicar con GitHub Pages (gratis)

1. En el repositorio: **Settings > Pages**.
2. En "Build and deployment" → Source: **Deploy from a branch**.
3. Branch: `main` (o `master`), carpeta `/root` → **Save**.
4. En un par de minutos GitHub te da un link tipo
   `https://tu-usuario.github.io/tu-repositorio/` — esa es la app, ábrela desde el celular de cada uno.

## 8. Primer uso

> ⚠️ No crees tu cuenta hasta haber terminado los pasos 1 a 4 (Firebase
> configurado, Authentication activado, Firestore creado con sus Reglas
> publicadas, y Cloudinary configurado). Si te registras antes de que
> Firestore exista, la cuenta se crea a medias y verás un error — la app
> ahora limpia sola esa cuenta a medias, así que si eso pasa, solo revisa
> el paso que falte y vuelve a intentar el registro con el mismo correo.

1. **Tú entras primero**: en "¿Primera vez? Crear una cuenta" deja seleccionado "Crear código nuevo", pon tu nombre, correo y contraseña, y crea la cuenta. La app te mostrará un **código de 6 caracteres** (ej. `7K2P9X`) — guárdalo y compártelo con tu pareja por WhatsApp o como prefieran.
2. **Tu pareja entra después**: en "¿Primera vez? Crear una cuenta" elige "Unirme con un código", pone ese código, su nombre, su propio correo y contraseña. Con eso queda enlazada a tu mismo espacio privado.
3. Al entrar, la app pedirá la **fecha de inicio** de la relación una sola vez — se guarda para ambos.
4. Desde "+ Añadir lugar" empiezan su lista. Al entrar a un lugar pueden marcarlo como visitado con la fecha y subir fotos desde el celular o la PC — ambos ven todo en tiempo real, y reciben un aviso dentro de la app cuando el otro añade un lugar, lo marca como visitado, o sube una foto (mientras la tengan abierta; no es una notificación push del sistema).

---

## Estructura del proyecto

```
nuestro-mapa/
├── index.html          # Toda la interfaz (login + app)
├── styles.css           # Estilos (tema "pasaporte / cuaderno de viaje")
├── README.md
└── js/
    ├── firebase-config.js  # Tus llaves de Firebase (editar en el paso 1)
    ├── auth.js              # Login, registro, cierre de sesión
    ├── counter.js            # Contador "llevamos juntos"
    ├── places.js              # Lugares: crear, listar, fotos
    └── app.js                  # Arranque de la app
```

## Costo

Todo queda en planes gratuitos y ninguno pide tarjeta de crédito:
- **Firebase Spark** (login + Firestore): 50 mil lecturas/día, autenticación ilimitada.
- **Cloudinary free tier** (fotos): 25 GB de almacenamiento y 25 GB de transferencia al mes.

De sobra para el uso de dos personas.

## Posibles mejoras futuras

- Notificaciones push del sistema (con la app cerrada), que requerirían activar Firebase Cloud Messaging y sí necesitan el plan de pago Blaze — por eso, por ahora, las notificaciones son solo dentro de la app.
- Modo "sorpresa": lugares ocultos hasta la fecha del viaje.

## Solución de problemas

**"No se pudo completar el registro..." o "No se pudo cargar tu cuenta..."**
Desde esta versión, el mensaje de error incluye el detalle técnico exacto
entre paréntesis — cópialo, casi siempre apunta a una de estas dos causas:

- *Firestore Database no existe todavía*: ve a Firebase Console > Build >
  Firestore Database. Si ves un botón "Create database", créala (paso 3).
- *Las Reglas no están publicadas (o tienen un error)*: ve a Firestore
  Database > pestaña Rules, y compáralas letra por letra con las del paso 3
  de este README. Dale **Publish** — si hay un error de sintaxis, Firebase
  no te dejará publicar y te lo marcará en rojo ahí mismo.

Si te registraste antes de corregir esto, no hay problema: la app borra
sola la cuenta que quedó a medias apenas falla, así que puedes volver a
intentar el registro con el mismo correo una vez arreglado lo anterior.

**Alguien más encontró el link de la app**
No puede ver nada: sin el código de 6 caracteres que ustedes se compartieron
en privado, cualquier cuenta que cree queda sin `couples` asociado y las
Reglas de Firestore le niegan el acceso a todo.
