// ============================================================
// LUGARES: CRUD + FOTOS + CATEGORÍAS + NOTIFICACIONES + DESCARGA
// ============================================================

const CATEGORY_META = {
  playa: { label: 'Playa', emoji: '🏖️' },
  ciudad: { label: 'Ciudad', emoji: '🏙️' },
  comida: { label: 'Comida', emoji: '🍽️' },
  aventura: { label: 'Aventura', emoji: '🥾' },
  otro: { label: 'Otro', emoji: '📍' },
};

let allPlaces = [];
let currentFilter = 'all';
let currentCategoryFilter = 'all';
let currentSort = 'recent';
let currentDetailId = null;
let unsubscribePlaces = null;
let placesCache = {};
let initialLoadDone = false;

function listenPlaces() {
  if (unsubscribePlaces) unsubscribePlaces();
  unsubscribePlaces = coupleRef().collection('places')
    .orderBy('addedAt', 'desc')
    .onSnapshot((snap) => {
      const currentUserName = auth.currentUser.displayName || auth.currentUser.email;

      // Notificaciones en tiempo real: solo si ya pasó la primera carga,
      // para no bombardear con toasts al abrir la app.
      if (initialLoadDone) {
        snap.docChanges().forEach((change) => {
          const data = { id: change.doc.id, ...change.doc.data() };

          if (change.type === 'added') {
            if (data.addedBy && data.addedBy !== currentUserName) {
              showToast(`${data.addedBy} añadió "${data.name}" a la lista ✨`);
            }
          } else if (change.type === 'modified') {
            const prev = placesCache[data.id];
            if (!prev) return;

            if (prev.status !== 'visited' && data.status === 'visited' && data.visitedBy !== currentUserName) {
              showToast(`${data.visitedBy || 'Tu pareja'} marcó "${data.name}" como visitado 🎉`);
            }

            const prevPhotoCount = (prev.photos || []).length;
            const newPhotos = data.photos || [];
            if (newPhotos.length > prevPhotoCount) {
              const lastPhoto = newPhotos[newPhotos.length - 1];
              if (lastPhoto && lastPhoto.uploadedBy && lastPhoto.uploadedBy !== currentUserName) {
                showToast(`${lastPhoto.uploadedBy} subió una foto a "${data.name}" 📷`);
              }
            }
          }
        });
      }

      allPlaces = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      placesCache = {};
      allPlaces.forEach(p => { placesCache[p.id] = p; });
      initialLoadDone = true;

      renderPlaces();
      if (currentDetailId) {
        const updated = allPlaces.find(p => p.id === currentDetailId);
        if (updated) renderDetail(updated);
      }
    }, (err) => {
      console.error(err);
      showToast('No se pudieron cargar los lugares.');
    });
}

function renderPlaces() {
  const grid = document.getElementById('places-grid');
  const empty = document.getElementById('places-empty');
  const summary = document.getElementById('places-summary');

  const visited = allPlaces.filter(p => p.status === 'visited').length;
  const pending = allPlaces.length - visited;
  summary.textContent = allPlaces.length === 0
    ? 'Aún no hay lugares.'
    : `${allPlaces.length} en total · ${visited} visitados · ${pending} por visitar`;

  let filtered = allPlaces.filter(p => {
    if (currentFilter !== 'all' && p.status !== currentFilter) return false;
    if (currentCategoryFilter !== 'all' && (p.category || 'otro') !== currentCategoryFilter) return false;
    return true;
  });

  grid.innerHTML = '';
  if (filtered.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  if (currentSort === 'name') {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    filtered.forEach(place => grid.appendChild(buildPlaceCard(place)));
  } else if (currentSort === 'category') {
    const groups = {};
    filtered.forEach(p => {
      const cat = p.category || 'otro';
      (groups[cat] = groups[cat] || []).push(p);
    });
    Object.keys(CATEGORY_META).forEach(catKey => {
      if (!groups[catKey]) return;
      const header = document.createElement('h3');
      header.className = 'category-group-header';
      header.textContent = `${CATEGORY_META[catKey].emoji} ${CATEGORY_META[catKey].label}`;
      grid.appendChild(header);
      groups[catKey].forEach(place => grid.appendChild(buildPlaceCard(place)));
    });
  } else {
    filtered.forEach(place => grid.appendChild(buildPlaceCard(place)));
  }
}

function buildPlaceCard(place) {
  const card = document.createElement('div');
  card.className = 'place-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');

  const cat = CATEGORY_META[place.category] || CATEGORY_META.otro;
  const photos = place.photos || [];
  let thumbsHtml = '';
  if (photos.length > 0) {
    thumbsHtml = '<div class="place-card-thumbs">' +
      photos.slice(0, 3).map(p => `<img src="${p.url}" alt="" loading="lazy">`).join('') +
      (photos.length > 3 ? `<div class="place-card-thumb-more">+${photos.length - 3}</div>` : '') +
      '</div>';
  }

  card.innerHTML = `
    ${place.status === 'visited' ? '<span class="stamp">Visitado</span>' : ''}
    <h3 class="place-card-name">${escapeHtml(place.name)}</h3>
    <p class="place-card-notes">${escapeHtml(place.notes || '')}</p>
    <span class="category-badge category-badge--${place.category || 'otro'}">${cat.emoji} ${cat.label}</span>
    ${thumbsHtml}
  `;
  card.addEventListener('click', () => openDetail(place.id));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') openDetail(place.id);
  });
  return card;
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter;
    renderPlaces();
  });
});

document.getElementById('category-filter').addEventListener('change', (e) => {
  currentCategoryFilter = e.target.value;
  renderPlaces();
});

document.getElementById('sort-control').addEventListener('change', (e) => {
  currentSort = e.target.value;
  renderPlaces();
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Añadir lugar ----------
const modalPlace = document.getElementById('modal-place');
document.getElementById('add-place-btn').addEventListener('click', () => {
  document.getElementById('modal-place-title').textContent = 'Añadir un lugar';
  document.getElementById('place-id').value = '';
  document.getElementById('place-name').value = '';
  document.getElementById('place-notes').value = '';
  document.getElementById('place-category').value = 'otro';
  document.getElementById('place-form-error').classList.add('hidden');
  document.getElementById('place-form-submit').textContent = 'Guardar';
  modalPlace.classList.remove('hidden');
  document.getElementById('place-name').focus();
});
document.getElementById('modal-place-close').addEventListener('click', () => modalPlace.classList.add('hidden'));
modalPlace.addEventListener('click', (e) => { if (e.target === modalPlace) modalPlace.classList.add('hidden'); });

document.getElementById('edit-place-btn').addEventListener('click', () => {
  const place = allPlaces.find(p => p.id === currentDetailId);
  if (!place) return;
  document.getElementById('modal-place-title').textContent = 'Editar lugar';
  document.getElementById('place-id').value = place.id;
  document.getElementById('place-name').value = place.name;
  document.getElementById('place-notes').value = place.notes || '';
  document.getElementById('place-category').value = place.category || 'otro';
  document.getElementById('place-form-error').classList.add('hidden');
  document.getElementById('place-form-submit').textContent = 'Guardar cambios';
  modalDetail.classList.add('hidden');
  modalPlace.classList.remove('hidden');
  document.getElementById('place-name').focus();
});

document.getElementById('place-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('place-id').value;
  const name = document.getElementById('place-name').value.trim();
  const notes = document.getElementById('place-notes').value.trim();
  const category = document.getElementById('place-category').value || 'otro';
  const errorEl = document.getElementById('place-form-error');
  const submitBtn = document.getElementById('place-form-submit');
  if (!name) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando…';
  try {
    if (id) {
      await coupleRef().collection('places').doc(id).update({ name, notes, category });
      showToast('Lugar actualizado ✎');
    } else {
      await coupleRef().collection('places').add({
        name,
        notes,
        category,
        status: 'pending',
        photos: [],
        addedBy: auth.currentUser.displayName || auth.currentUser.email,
        addedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showToast('Lugar añadido ✈️');
    }
    modalPlace.classList.add('hidden');
  } catch (err) {
    console.error(err);
    errorEl.textContent = 'No se pudo guardar. Intenta de nuevo.';
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = id ? 'Guardar cambios' : 'Guardar';
  }
});

// ---------- Detalle de lugar ----------
const modalDetail = document.getElementById('modal-detail');

function openDetail(id) {
  currentDetailId = id;
  const place = allPlaces.find(p => p.id === id);
  if (!place) return;
  renderDetail(place);
  modalDetail.classList.remove('hidden');
}

function renderDetail(place) {
  document.getElementById('detail-name').textContent = place.name;
  document.getElementById('detail-notes').textContent = place.notes || '';
  document.getElementById('detail-notes').classList.toggle('hidden', !place.notes);

  const cat = CATEGORY_META[place.category] || CATEGORY_META.otro;
  document.getElementById('detail-category-badge').textContent = `${cat.emoji} ${cat.label}`;
  document.getElementById('detail-category-badge').className = `category-badge category-badge--${place.category || 'otro'}`;

  const statusLabel = document.getElementById('detail-status-label');
  const markBox = document.getElementById('detail-mark-visited');
  const visitedInfo = document.getElementById('detail-visited-info');
  const uploadBox = document.getElementById('photo-upload-box');

  if (place.status === 'visited') {
    statusLabel.textContent = 'Visitado';
    markBox.classList.add('hidden');
    visitedInfo.classList.remove('hidden');
    uploadBox.classList.remove('hidden');
    document.getElementById('visited-date-label').textContent =
      place.dateVisited ? formatDateEs(place.dateVisited) : '';
  } else {
    statusLabel.textContent = 'Por visitar';
    markBox.classList.remove('hidden');
    visitedInfo.classList.add('hidden');
    uploadBox.classList.add('hidden');
    document.getElementById('visited-date-input').value = new Date().toISOString().slice(0, 10);
  }

  const photoGrid = document.getElementById('detail-photos');
  photoGrid.innerHTML = '';
  (place.photos || []).forEach(photo => {
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = `Foto de ${place.name}`;
    img.loading = 'lazy';
    img.addEventListener('click', () => openLightbox(photo.url));
    photoGrid.appendChild(img);
  });

  document.getElementById('download-place-btn').classList.toggle('hidden', (place.photos || []).length === 0);
}

function formatDateEs(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}

document.getElementById('modal-detail-close').addEventListener('click', () => {
  modalDetail.classList.add('hidden');
  currentDetailId = null;
});
modalDetail.addEventListener('click', (e) => { if (e.target === modalDetail) { modalDetail.classList.add('hidden'); currentDetailId = null; } });

document.getElementById('visited-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('visited-date-input').value;
  if (!currentDetailId || !date) return;
  await coupleRef().collection('places').doc(currentDetailId).update({
    status: 'visited',
    dateVisited: date,
    visitedBy: auth.currentUser.displayName || auth.currentUser.email,
  });
  showToast('¡Felicidades, uno más visitado! 🎉');
});

document.getElementById('delete-place-btn').addEventListener('click', async () => {
  if (!currentDetailId) return;
  if (!confirm('¿Eliminar este lugar y sus fotos? Esta acción no se puede deshacer.')) return;
  await coupleRef().collection('places').doc(currentDetailId).delete();
  modalDetail.classList.add('hidden');
  currentDetailId = null;
  showToast('Lugar eliminado.');
});

// ---------- Subida de fotos (Cloudinary, sin tarjeta de crédito) ----------
document.getElementById('photo-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0 || !currentDetailId) return;

  if (cloudinaryConfig.cloudName === 'TU_CLOUD_NAME') {
    showToast('Falta configurar Cloudinary en firebase-config.js');
    e.target.value = '';
    return;
  }

  const progressWrap = document.getElementById('upload-progress');
  const progressBar = document.getElementById('upload-progress-bar');
  const labelText = document.getElementById('upload-label-text');
  progressWrap.classList.remove('hidden');
  labelText.textContent = `Subiendo 0/${files.length}…`;

  let done = 0;
  for (const file of files) {
    try {
      const photo = await uploadToCloudinary(file, (pct) => {
        progressBar.style.width = pct + '%';
      });
      await coupleRef().collection('places').doc(currentDetailId).update({
        photos: firebase.firestore.FieldValue.arrayUnion({
          url: photo.url,
          publicId: photo.publicId,
          uploadedBy: auth.currentUser.displayName || auth.currentUser.email,
          uploadedAt: new Date().toISOString(),
        }),
      });
      done++;
      labelText.textContent = `Subiendo ${done}/${files.length}…`;
      progressBar.style.width = '0%';
    } catch (err) {
      console.error(err);
      showToast('No se pudo subir una foto.');
    }
  }

  progressWrap.classList.add('hidden');
  progressBar.style.width = '0%';
  labelText.textContent = '+ Subir fotos';
  e.target.value = '';
  showToast('Fotos subidas 📷');
});

function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', `nuestro-mapa/${currentCoupleCode}/${currentDetailId}`);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        onProgress((evt.loaded / evt.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({ url: data.secure_url, publicId: data.public_id });
      } else {
        reject(new Error('Cloudinary upload failed: ' + xhr.status));
      }
    };
    xhr.onerror = () => reject(new Error('Cloudinary network error'));
    xhr.send(formData);
  });
}

// ---------- Descarga de fotos en un solo zip ----------
async function downloadPhotosAsZip(photos, zipFilename) {
  if (!window.JSZip) {
    showToast('No se pudo cargar el empaquetador de fotos.');
    return;
  }
  if (!photos || photos.length === 0) {
    showToast('No hay fotos para descargar.');
    return;
  }

  const zip = new JSZip();
  let count = 0;
  for (const photo of photos) {
    try {
      const res = await fetch(photo.url);
      const blob = await res.blob();
      const ext = (blob.type && blob.type.split('/')[1]) || 'jpg';
      const folder = photo.placeFolder ? `${photo.placeFolder}/` : '';
      zip.file(`${folder}foto-${++count}.${ext}`, blob);
    } catch (err) {
      console.error('No se pudo descargar una foto', err);
    }
  }

  if (count === 0) {
    showToast('No se pudo descargar ninguna foto.');
    return;
  }

  const blobZip = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blobZip);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Descarga lista 📦');
}

function sanitizeFilename(str) {
  return (str || 'lugar')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase();
}

document.getElementById('download-place-btn').addEventListener('click', async () => {
  const place = allPlaces.find(p => p.id === currentDetailId);
  if (!place) return;
  const btn = document.getElementById('download-place-btn');
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparando…';
  await downloadPhotosAsZip(place.photos || [], `${sanitizeFilename(place.name)}-fotos.zip`);
  btn.disabled = false;
  btn.textContent = original;
});

document.getElementById('download-all-btn').addEventListener('click', async () => {
  const btn = document.getElementById('download-all-btn');
  const allPhotos = [];
  allPlaces.forEach(p => {
    (p.photos || []).forEach(photo => {
      allPhotos.push({ ...photo, placeFolder: sanitizeFilename(p.name) });
    });
  });
  if (allPhotos.length === 0) {
    showToast('Todavía no hay fotos para descargar.');
    return;
  }
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparando…';
  await downloadPhotosAsZip(allPhotos, 'nuestro-mapa-fotos.zip');
  btn.disabled = false;
  btn.textContent = original;
});

// ---------- Lightbox ----------
const lightbox = document.getElementById('lightbox');
function openLightbox(url) {
  document.getElementById('lightbox-img').src = url;
  lightbox.classList.remove('hidden');
}
document.getElementById('lightbox-close').addEventListener('click', () => lightbox.classList.add('hidden'));
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.classList.add('hidden'); });

// ---------- Toast ----------
let toastTimeout = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add('hidden'), 2600);
}
