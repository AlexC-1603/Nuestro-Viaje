// ============================================================
// AUTENTICACIÓN + CÓDIGO ÚNICO DE PAREJA
// ============================================================
// currentCoupleCode identifica el "espacio" privado compartido por
// los dos. Se usa desde counter.js y places.js para leer/escribir
// siempre dentro de couples/{currentCoupleCode}/... y nunca en
// colecciones sueltas que cualquier cuenta pudiera tocar.
// ============================================================

let currentCoupleCode = null;

// Mientras el flujo de registro está a mitad de camino (creando la cuenta
// y armando su código de pareja), el chequeo automático de sesión no debe
// intervenir: si lo hiciera, vería que "users/{uid}" todavía no existe y
// cerraría la sesión antes de que termináramos de crearlo. Este flag evita
// esa condición de carrera.
let registrationInProgress = false;

function coupleRef() {
  return db.collection('couples').doc(currentCoupleCode);
}

const viewLoading = document.getElementById('view-loading');
const viewLogin = document.getElementById('view-login');
const viewApp = document.getElementById('view-app');

const loginCard = document.getElementById('login-form').closest('.login-card');
const registerCard = document.getElementById('register-card');

document.getElementById('show-register').addEventListener('click', () => {
  loginCard.classList.add('hidden');
  registerCard.classList.remove('hidden');
});
document.getElementById('show-login').addEventListener('click', () => {
  registerCard.classList.add('hidden');
  loginCard.classList.remove('hidden');
});

// --- Selector: crear código nuevo vs. unirme con uno ---
let registerMode = 'create';
document.getElementById('mode-create').addEventListener('click', () => setRegisterMode('create'));
document.getElementById('mode-join').addEventListener('click', () => setRegisterMode('join'));

function setRegisterMode(mode) {
  registerMode = mode;
  document.getElementById('mode-create').classList.toggle('active', mode === 'create');
  document.getElementById('mode-join').classList.toggle('active', mode === 'join');
  const codeField = document.getElementById('join-code-field');
  const codeInput = document.getElementById('register-code');
  codeField.classList.toggle('hidden', mode !== 'join');
  codeInput.required = mode === 'join';
}

function generateCoupleCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin caracteres que se confunden (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// --- Login ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Entrando…';
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    errorEl.textContent = traducirErrorAuth(err) || 'Algo salió mal. Intenta de nuevo.';
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Entrar';
  }
});

// --- Registro (crear código nuevo o unirse con uno existente) ---
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;
  const codeInput = document.getElementById('register-code').value.trim().toUpperCase();
  const errorEl = document.getElementById('register-error');
  const submitBtn = document.getElementById('register-submit');
  errorEl.classList.add('hidden');

  if (registerMode === 'join' && !codeInput) {
    errorEl.textContent = 'Ingresa el código que te compartió tu pareja.';
    errorEl.classList.remove('hidden');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creando…';
  registrationInProgress = true;

  let cred = null;
  try {
    cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });

    // Validar el código de pareja RECIÉN AHORA, con la cuenta ya creada.
    // Tiene que ser así y no antes: las Reglas de Firestore exigen sesión
    // iniciada (request.auth != null) para poder leer "couples/{code}", y
    // antes de crear la cuenta no la hay. Si esto fallaba antes de crear
    // la cuenta, Firestore devolvía "permission-denied" (no porque el
    // código estuviera mal, sino porque nadie había iniciado sesión
    // todavía), y eso se mostraba engañosamente como "código no disponible".
    if (registerMode === 'join') {
      const coupleDoc = await db.collection('couples').doc(codeInput).get();
      if (!coupleDoc.exists) {
        throw Object.assign(new Error('Ese código no existe. Revísalo con tu pareja.'), { code: 'app/code-not-found' });
      }
      const members = coupleDoc.data().memberUids || [];
      if (members.length >= 2) {
        throw Object.assign(new Error('Ese código ya está siendo usado por dos personas.'), { code: 'app/code-full' });
      }
    }

    let coupleCode;
    if (registerMode === 'create') {
      coupleCode = generateCoupleCode();
      await db.collection('couples').doc(coupleCode).set({
        ownerUid: cred.user.uid,
        memberUids: [cred.user.uid],
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      coupleCode = codeInput;
      await db.collection('couples').doc(coupleCode).update({
        memberUids: firebase.firestore.FieldValue.arrayUnion(cred.user.uid),
      });
    }

    await db.collection('users').doc(cred.user.uid).set({
      displayName: name,
      coupleCode,
    });

    if (registerMode === 'create') {
      showInviteCodeModal(coupleCode);
    }

    // Recién ahora es seguro dejar que el chequeo de sesión continúe: el
    // documento de usuario y su código de pareja ya existen en Firestore.
    registrationInProgress = false;
    await enterAppWithUser(cred.user);
  } catch (err) {
    console.error(err);
    registrationInProgress = false;

    // Si la cuenta llegó a crearse en Firebase Auth pero algo después
    // falló (ej. Firestore no configurado), la borramos de inmediato.
    // Así, al reintentar, no chocan con "ese correo ya está en uso".
    if (cred && cred.user) {
      try {
        await cred.user.delete();
      } catch (cleanupErr) {
        console.error('No se pudo limpiar la cuenta a medio crear:', cleanupErr);
      }
    }

    if (err.code === 'app/code-not-found' || err.code === 'app/code-full') {
      errorEl.textContent = err.message;
    } else {
      const friendly = traducirErrorAuth(err);
      errorEl.textContent = friendly
        ? friendly
        : `No se pudo completar el registro. Revisa que Firestore Database exista y que las Reglas estén publicadas (ver README). Detalle: ${err.message || err.code || 'error desconocido'}`;
    }
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Crear cuenta y entrar';
  }
});

// --- Modal con el código generado ---
function showInviteCodeModal(code) {
  document.getElementById('invite-code-text').textContent = code;
  document.getElementById('modal-invite-code').classList.remove('hidden');
}
document.getElementById('invite-code-continue').addEventListener('click', () => {
  document.getElementById('modal-invite-code').classList.add('hidden');
});
document.getElementById('copy-code-btn').addEventListener('click', async () => {
  const code = document.getElementById('invite-code-text').textContent;
  const btn = document.getElementById('copy-code-btn');
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(code);
    btn.textContent = '¡Copiado!';
  } catch (err) {
    btn.textContent = 'No se pudo copiar';
  }
  setTimeout(() => { btn.textContent = original; }, 1600);
});

// --- Logout ---
document.getElementById('logout-btn').addEventListener('click', () => {
  auth.signOut();
});

function traducirErrorAuth(err) {
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-email': 'Ese correo no parece válido.',
    'auth/user-not-found': 'No existe una cuenta con ese correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/invalid-credential': 'Correo o contraseña incorrectos.',
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
    'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
    'auth/network-request-failed': 'Problema de conexión. Intenta de nuevo.',
    'permission-denied': 'Ese código ya no está disponible.',
  };
  return map[code] || null;
}

// --- Estado de sesión ---
async function enterAppWithUser(user) {
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    if (!userDoc.exists || !userDoc.data().coupleCode) {
      throw new Error('missing-couple-code');
    }
    currentCoupleCode = userDoc.data().coupleCode;
  } catch (err) {
    console.error(err);
    await auth.signOut();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = `No se pudo cargar tu cuenta. Revisa las Reglas de Firestore (ver README). Detalle: ${err.message || err.code || 'sin código de pareja asociado'}`;
    errorEl.classList.remove('hidden');
    viewApp.classList.add('hidden');
    viewLogin.classList.remove('hidden');
    return;
  }

  viewLogin.classList.add('hidden');
  viewApp.classList.remove('hidden');
  onUserReady(user);
  await updateCoupleHeader(user);
}

// Muestra en el encabezado los nombres de los DOS miembros de la pareja
// (no solo el de quien inició sesión), y avisa si el otro aún no se unió
// con el código.
async function updateCoupleHeader(user) {
  const heroNamesEl = document.getElementById('hero-names');
  const waitingBanner = document.getElementById('waiting-partner-banner');
  try {
    const coupleDoc = await coupleRef().get();
    const memberUids = (coupleDoc.exists && coupleDoc.data().memberUids) || [user.uid];

    const names = await Promise.all(memberUids.map(async (uid) => {
      if (uid === user.uid) return user.displayName || 'Tú';
      const doc = await db.collection('users').doc(uid).get();
      return (doc.exists && doc.data().displayName) || 'tu pareja';
    }));

    heroNamesEl.textContent = names.join(' y ');

    if (memberUids.length < 2) {
      waitingBanner.textContent = `Todavía falta que tu pareja se una con el código ${currentCoupleCode}. Compárteselo para que vean lo mismo los dos.`;
      waitingBanner.classList.remove('hidden');
    } else {
      waitingBanner.classList.add('hidden');
    }
  } catch (err) {
    console.error('No se pudo cargar el encabezado de pareja', err);
    heroNamesEl.textContent = user.displayName || 'nosotros';
  }
}

auth.onAuthStateChanged(async (user) => {
  viewLoading.classList.add('hidden');

  // El flujo de registro (arriba) todavía está creando el código de
  // pareja; se encargará de llamar a enterAppWithUser() él mismo cuando
  // termine. Si dejáramos que este chequeo actuara ahora, encontraría el
  // documento de usuario a medio crear y cerraría la sesión por error.
  if (registrationInProgress) return;

  if (user) {
    await enterAppWithUser(user);
  } else {
    currentCoupleCode = null;
    viewApp.classList.add('hidden');
    viewLogin.classList.remove('hidden');
  }
});
