// ================================================================
// KREATOR MAPOWANIA + KALIBRACJA + WYBÓR PLANSZY
// ================================================================

const VENDOR_ID = 0x0483;
const PRODUCT_ID = 0x5750;

const FUNCTIONS = [
  { key: '---',      label: '---' },
  { key: 'throttle', label: 'THROTTLE' },
  { key: 'yaw',      label: 'YAW' },
  { key: 'pitch',    label: 'PITCH' },
  { key: 'roll',     label: 'ROLL' },
  { key: 'flip',     label: 'FLIP' },
  { key: 'reset',    label: 'RESET' }
];

const CALIB_ORDER = ['throttle', 'yaw', 'pitch', 'roll'];

const CALIB_INSTR = {
  throttle: 'Rusz <b>LEWYM drążkiem w GÓRĘ i w DÓŁ</b> — kilka razy do oporu',
  yaw:      'Rusz <b>LEWYM drążkiem w LEWO i w PRAWO</b> — kilka razy do oporu',
  pitch:    'Rusz <b>PRAWYM drążkiem w GÓRĘ i w DÓŁ</b> — kilka razy do oporu',
  roll:     'Rusz <b>PRAWYM drążkiem w LEWO i w PRAWO</b> — kilka razy do oporu'
};

window.padData = {
  connected: false,
  device: null,
  rawPairs: [0,0,0,0,0,0,0,0],
  input: { throttle: 0, yaw: 0, roll: 0, pitch: 0 },
  profile: null
};

// ================================================================
// POŁĄCZENIE
// ================================================================
async function connectPad(showPrompt) {
  try {
    let devices = await navigator.hid.getDevices();
    let dev = devices.find(d => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID);

    if (!dev) {
      if (!showPrompt) return null;
      const selected = await navigator.hid.requestDevice({
        filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }]
      });
      if (!selected.length) return null;
      dev = selected[0];
    }

    if (!dev.opened) await dev.open();

    if (window.padData.device) {
      try { window.padData.device.removeEventListener('inputreport', onInputReport); } catch (e) {}
    }

    window.padData.device = dev;
    window.padData.connected = true;
    dev.addEventListener('inputreport', onInputReport);

    console.log('✅ Pad połączony:', dev.productName);
    return dev;
  } catch (err) {
    console.error('❌ Błąd połączenia:', err);
    return null;
  }
}

function onInputReport(e) {
  const d = new Uint8Array(e.data.buffer);
  if (d.length < 16) return;

  for (let i = 0; i < 8; i++) {
    window.padData.rawPairs[i] = d[i*2] | (d[i*2+1] << 8);
  }

  if (window.padData.profile && window.padData.profile.map) {
    const m = window.padData.profile.map;
    for (const fn of ['throttle', 'yaw', 'pitch', 'roll']) {
      if (m[fn] && m[fn].pair >= 0) {
        const raw = window.padData.rawPairs[m[fn].pair];
        const target = normalizeAxis(raw, m[fn]);
        window.padData.input[fn] = window.padData.input[fn] * 0.2 + target * 0.8;
      } else {
        window.padData.input[fn] = 0;
      }
    }
  }

  if (window.padData.onRawUpdate) window.padData.onRawUpdate();
}

function normalizeAxis(raw, cfg) {
  const { min, max, center, inverted } = cfg;
  let v;
  if (raw < center) {
    v = -(center - raw) / Math.max(1, center - min);
  } else {
    v = (raw - center) / Math.max(1, max - center);
  }
  if (Math.abs(v) < 0.05) v = 0;
  v = Math.max(-1, Math.min(1, v));
  return inverted ? -v : v;
}

// ================================================================
// UI
// ================================================================
function showStep(id) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('menuBtn').classList.remove('hidden');
}

function showOverlay() {
  document.getElementById('overlay').classList.remove('hidden');
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('menuBtn').classList.add('hidden');
}

// ================================================================
// MAPOWANIE
// ================================================================
let mappingState = {
  assignments: ['---', '---', '---', '---', '---', '---', '---', '---'],
  minMax: {}
};

function initMappingUI() {
  const container = document.getElementById('axis-list');
  container.innerHTML = '';

  for (let i = 0; i < 8; i++) {
    const row = document.createElement('div');
    row.className = 'axis-row';
    row.innerHTML = `
      <span class="axis-label">P${i}</span>
      <span class="axis-value" id="axis-val-${i}">—</span>
      <div class="axis-bar">
        <div class="axis-bar-center"></div>
        <div class="axis-bar-fill" id="axis-fill-${i}" style="left:0%;width:0%;"></div>
      </div>
      <select class="axis-select" id="axis-sel-${i}">
        ${FUNCTIONS.map(f => `<option value="${f.key}">${f.label}</option>`).join('')}
      </select>
      <span class="axis-status" id="axis-sta-${i}">—</span>
    `;
    container.appendChild(row);

    document.getElementById(`axis-sel-${i}`).addEventListener('change', (e) => {
      mappingState.assignments[i] = e.target.value;
      updateAxisStatus(i);
    });
  }

  for (let i = 0; i < 8; i++) {
    mappingState.minMax[i] = { min: 99999, max: -1 };
  }

  window.padData.onRawUpdate = updateAxisBars;
  updateAxisBars();
}

function updateAxisBars() {
  const pairs = window.padData.rawPairs;
  for (let i = 0; i < 8; i++) {
    const v = pairs[i];
    const mm = mappingState.minMax[i];
    if (v < mm.min) mm.min = v;
    if (v > mm.max) mm.max = v;

    document.getElementById(`axis-val-${i}`).textContent = v;

    const pct = Math.max(0, Math.min(100, (v / 2047) * 100));
    const fill = document.getElementById(`axis-fill-${i}`);
    fill.style.left = '0%';
    fill.style.width = pct + '%';
  }
}

function updateAxisStatus(i) {
  const sel = mappingState.assignments[i];
  const sta = document.getElementById(`axis-sta-${i}`);
  if (sel === '---') {
    sta.textContent = '—';
    sta.style.color = '#666';
  } else {
    sta.textContent = '✓';
    sta.style.color = '#0f0';
  }
}

// ================================================================
// KALIBRACJA
// ================================================================
let calibState = null;

function startCalibration() {
  const assignedPairs = {};
  for (let i = 0; i < 8; i++) {
    const fn = mappingState.assignments[i];
    if (fn !== '---' && !assignedPairs[fn]) {
      assignedPairs[fn] = i;
    }
  }

  const missing = CALIB_ORDER.filter(fn => !(fn in assignedPairs));
  if (missing.length > 0) {
    alert('❌ Nie przypisano funkcji: ' + missing.join(', ') + '\n\nWróć do mapowania i przypisz wszystkie 4 funkcje (THROTTLE, YAW, PITCH, ROLL).');
    return;
  }

  calibState = {
    assignedPairs: assignedPairs,
    queue: [...CALIB_ORDER],
    current: null,
    duration: 4000,
    startTime: 0,
    min: 99999,
    max: -1,
    results: {}
  };

  showStep('step-calib');
  nextCalibrationStep();
}

function nextCalibrationStep() {
  if (calibState.queue.length === 0) {
    finishCalibration();
    return;
  }

  calibState.current = calibState.queue.shift();
  calibState.startTime = performance.now();
  calibState.min = 99999;
  calibState.max = -1;

  document.getElementById('calib-instruction').innerHTML = CALIB_INSTR[calibState.current];
  document.getElementById('calib-progress-fill').style.width = '0%';
  document.getElementById('calib-values').textContent = 'Ruszaj drążkiem...';
}

function updateCalibration() {
  if (!calibState || !calibState.current) return;

  const pairIdx = calibState.assignedPairs[calibState.current];
  const v = window.padData.rawPairs[pairIdx];

  if (v < calibState.min) calibState.min = v;
  if (v > calibState.max) calibState.max = v;

  const elapsed = performance.now() - calibState.startTime;
  const pct = Math.min(100, (elapsed / calibState.duration) * 100);
  document.getElementById('calib-progress-fill').style.width = pct + '%';
  document.getElementById('calib-values').textContent =
    `${calibState.current.toUpperCase()} (P${pairIdx})  min=${calibState.min}  max=${calibState.max}`;

  if (elapsed >= calibState.duration) {
    calibState.results[calibState.current] = {
      pair: pairIdx,
      min: calibState.min,
      max: calibState.max
    };
    nextCalibrationStep();
  }
}

setInterval(updateCalibration, 50);

function finishCalibration() {
  const map = {};
  for (const fn of CALIB_ORDER) {
    const r = calibState.results[fn];
    map[fn] = {
      pair: r.pair,
      min: r.min,
      max: r.max,
      center: Math.round((r.min + r.max) / 2),
      inverted: false
    };
  }

  map.yaw.inverted = true;

  window.padData.profile = { map: map };
  calibState = null;
  showStep('step-done');
}

// ================================================================
// WYBÓR PLANSZY
// ================================================================
document.querySelectorAll('.world-card').forEach(card => {
  card.addEventListener('click', () => {
    const world = card.dataset.world;

    document.querySelectorAll('.world-card').forEach(c => c.style.boxShadow = 'none');
    const glowColor = world === 'beginner' ? '#0f0' : world === 'intermediate' ? '#ff0' : '#f00';
    card.style.boxShadow = '0 0 25px ' + glowColor;

    setTimeout(() => {
      hideOverlay();

      // Usuń poprzedni canvas jeśli istnieje (żeby nie było dwóch symulatorów naraz)
      const oldCanvas = document.querySelector('canvas');
      if (oldCanvas) oldCanvas.remove();

      if (window.startSimulator) {
        window.startSimulator(world);
      } else {
        alert('❌ Symulator nie jest gotowy — odśwież stronę');
      }
    }, 200);
  });
});

// ================================================================
// PRZYCISKI
// ================================================================
document.getElementById('btn-start').addEventListener('click', () => {
  showStep('step-connect');
});

document.getElementById('btn-connect').addEventListener('click', async () => {
  const status = document.getElementById('connect-status');
  status.textContent = '⏳ Łączę...';
  status.style.color = '#ff0';

  const dev = await connectPad(true);

  if (dev) {
    status.textContent = '✅ Połączono: ' + dev.productName;
    status.style.color = '#0f0';
    setTimeout(() => {
      initMappingUI();
      showStep('step-mapping');
    }, 500);
  } else {
    status.textContent = '❌ Nie udało się połączyć.';
    status.style.color = '#f44';
  }
});

document.getElementById('btn-mapping-next').addEventListener('click', () => {
  const assigned = mappingState.assignments.filter(a => a !== '---');
  if (assigned.length < 4) {
    alert('❌ Przypisz co najmniej 4 funkcje (THROTTLE, YAW, PITCH, ROLL).\nAktualnie: ' + assigned.length);
    return;
  }
  startCalibration();
});

document.getElementById('btn-recalibrate').addEventListener('click', () => {
  showOverlay();
  showStep('step-start');
});

// Przycisk "Menu" — powrót do wyboru planszy (bez powtarzania kalibracji)
document.getElementById('menuBtn').addEventListener('click', () => {
  // Usuń stary canvas, żeby zwolnić zasoby i nie mieć dwóch symulatorów
  const oldCanvas = document.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();

  showOverlay();
  showStep('step-done');
});

// ================================================================
// AUTO-POŁĄCZENIE
// ================================================================
(async () => {
  const dev = await connectPad(false);
  if (dev) console.log('✅ Auto-połączono z padem');
})();