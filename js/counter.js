// ============================================================
// CONTADOR "LLEVAMOS JUNTOS"
// ============================================================

let counterInterval = null;
let cachedStartDate = null;

function startCounter(startDateISO) {
  cachedStartDate = new Date(startDateISO + 'T00:00:00');
  document.getElementById('counter-wrap').classList.remove('hidden');
  document.getElementById('start-date-setup').classList.add('hidden');

  if (counterInterval) clearInterval(counterInterval);
  tickCounter();
  counterInterval = setInterval(tickCounter, 1000);
}

function showStartDateSetup() {
  document.getElementById('start-date-setup').classList.remove('hidden');
}

function tickCounter() {
  const now = new Date();
  let diffMs = now - cachedStartDate;
  if (diffMs < 0) diffMs = 0;

  let totalSeconds = Math.floor(diffMs / 1000);
  const seconds = totalSeconds % 60;
  totalSeconds = Math.floor(totalSeconds / 60);
  const minutes = totalSeconds % 60;
  totalSeconds = Math.floor(totalSeconds / 60);
  const hours = totalSeconds % 24;
  totalSeconds = Math.floor(totalSeconds / 24);
  const totalDays = totalSeconds; // días completos desde el inicio

  // Años / meses / días calendario, para que sea humano y no solo "días totales"
  let { years, months, days } = calendarDiff(cachedStartDate, now);

  setText('c-years', pad(years));
  setText('c-months', pad(months));
  setText('c-days', pad(days));
  setText('c-hours', pad(hours));
  setText('c-mins', pad(minutes));
  setText('c-secs', pad(seconds));
}

function calendarDiff(start, now) {
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function pad(n) {
  return String(Math.max(0, n)).padStart(2, '0');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el.textContent !== val) el.textContent = val;
}

// --- Editar / guardar fecha de inicio ---
document.getElementById('edit-start-date').addEventListener('click', () => {
  const setup = document.getElementById('start-date-setup');
  setup.classList.toggle('hidden');
  if (cachedStartDate) {
    document.getElementById('start-date-input').value = cachedStartDate.toISOString().slice(0, 10);
  }
});

document.getElementById('start-date-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const value = document.getElementById('start-date-input').value;
  if (!value) return;
  await coupleRef().collection('config').doc('relationship').set({ startDate: value }, { merge: true });
  startCounter(value);
  showToast('Fecha guardada 💛');
});

async function loadStartDate() {
  const doc = await coupleRef().collection('config').doc('relationship').get();
  if (doc.exists && doc.data().startDate) {
    startCounter(doc.data().startDate);
  } else {
    showStartDateSetup();
  }
}
