// ============================================================
// ARRANQUE DE LA APP (se llama una vez el usuario inicia sesión)
// ============================================================

let appInitialized = false;

function onUserReady(user) {
  if (appInitialized) return; // evita duplicar listeners si onAuthStateChanged dispara de nuevo
  appInitialized = true;
  loadStartDate();
  listenPlaces();
}
