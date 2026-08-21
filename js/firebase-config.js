// ============================================================
// CONFIGURACIÓN DE FIREBASE (login + base de datos de lugares)
// ============================================================
// 1. Ve a https://console.firebase.google.com y crea un proyecto.
// 2. Dentro del proyecto: ⚙️ > "Configuración del proyecto" >
//    baja hasta "Tus apps" > crea una app web (ícono </>).
// 3. Copia el objeto "firebaseConfig" que te muestra y pégalo
//    reemplazando el de abajo.
// 4. Activa en el menú lateral: Authentication (método Correo/
//    contraseña) y Firestore Database (modo producción).
//    NO necesitas activar Storage ni tarjeta de crédito: las
//    fotos se suben a Cloudinary (ver más abajo).
//
// Este archivo es público en GitHub (así funcionan todas las apps
// web con Firebase) — la seguridad real la dan las Reglas de
// Firestore que están en el README, no esta clave.
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyD_4hanSxkNs09leVLqcKhkJzhEJydtvBc",
  authDomain: "nuestro-viaje-f061d.firebaseapp.com",
  projectId: "nuestro-viaje-f061d",
  storageBucket: "nuestro-viaje-f061d.firebasestorage.app",
  messagingSenderId: "181584998991",
  appId: "1:181584998991:web:7c227ae31fd3fdc033303a"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// ============================================================
// CONFIGURACIÓN DE CLOUDINARY (almacenamiento de fotos, gratis,
// sin tarjeta de crédito — hasta 25 GB en el plan gratuito)
// ============================================================
// 1. Crea una cuenta gratis en https://cloudinary.com/users/register/free
// 2. En el Dashboard copia tu "Cloud name" y pégalo abajo.
// 3. Ve a Settings (⚙️) > Upload > "Upload presets" > "Add upload preset".
//    - Signing Mode: cámbialo a "Unsigned".
//    - Guarda y copia el nombre del preset (ej. "abcdef12").
// 4. Pega ambos valores abajo.
// ============================================================

const cloudinaryConfig = {
  cloudName: "zoddwvhj",
  uploadPreset: "clptmimy",
};

// ============================================================
// PRIVACIDAD: código único de pareja
// ============================================================
// Ya no hace falta escribir correos aquí. La primera persona que
// se registra genera un código único (ej. "7K2P9X") y se lo
// comparte a su pareja para que se una con ese mismo código.
// A partir de ahí, sus datos quedan enlazados solo entre ustedes
// dos — nadie más, aunque cree una cuenta, puede verlos.
// La lógica vive en js/auth.js y la seguridad real la dan las
// Reglas de Firestore (ver README, sección "Seguridad").
// ============================================================
