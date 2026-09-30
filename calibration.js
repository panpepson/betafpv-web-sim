// ================================================================
// KREATOR MAPOWANIA + KALIBRACJA + WYBÓR PLANSZY
// ================================================================

import { t, getLang } from './i18n/index.js';

const VENDOR_ID  = 0x0483;
const PRODUCT_ID = 0x5750;

const FUNCTIONS = [
  { key: '---',      label: '---' },
  { key: 'throttle', label: 'THROTTLE' },
  { key: 'yaw',      label: 'YAW' },
  { key: 'pitch',    label: 'PITCH' },
  { key: 'roll',     label: 'ROLL' },
  { key: 'camera',   label: 'CAMERA' },
  { key: 'flip',     label: 'FLIP' },
  { key: 'reset',    label: 'RESET' }
];

const CALIB_ORDER = ['pitch', 'roll', 'throttle', 'yaw'];

const STICK_FOR_FN = {
  pitch:    'right',
  roll:     'right',
  throttle: 'left',
  yaw:      'left'
};

const CALIB_DURATION_MS   = 6000;
const CALIB_MIN_RANGE     = 500;
const STORAGE_KEY         = 'betafpv_calib_v1';
const SESSION_PAD_KEY     = 'betafpv_pad_session';
const STORAGE_MAX_AGE_MS  = 24 * 60 * 60 * 1000;

window.padData = {
  connected: false,
  device: null,
  rawPairs: [0,0,0,0,0,0,0,0],
  input: { throttle: 0, yaw: 0, roll: 0, pitch: 0 },
  profile: null,
  onRawUpdate: null,
  onDisconnect: null,
  onReconnect: null,
  _lastCameraState: null
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

    if (!connectPad._disconnectBound) {
      navigator.hid.addEventListener('disconnect', onDeviceDisconnect);
      connectPad._disconnectBound = true;
    }

    try {
      sessionStorage.setItem(SESSION_PAD_KEY,
        dev.productName + '|' + dev.vendorId + '|' + dev.productId);
    } catch (e) {}

    console.log('✅ Pad połączony:', dev.productName);
    return dev;
  } catch (err) {
    console.error('❌ Błąd połączenia:', err);
    return null;
  }
}

function onDeviceDisconnect(e) {
  if (e.device === window.padData.device) {
    console.warn('⚠️ Pad rozłączony');
    window.padData.connected = false;

    window.padData.input.throttle = 0;
    window.padData.input.yaw = 0;
    window.padData.input.roll = 0;
    window.padData.input.pitch = 0;

    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SESSION_PAD_KEY);
    } catch (err) {}

    if (window.padData.onDisconnect) window.padData.onDisconnect();
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

  // ─── Obsługa przełącznika CAMERA (3-pozycyjny) ───
  if (window.padData.profile && window.padData.profile.map) {
    let cameraPairIdx = -1;
    for (let i = 0; i < 8; i++) {
      if (mappingState.assignments[i] === 'camera') {
        cameraPairIdx = i;
        break;
      }
    }

    if (cameraPairIdx >= 0) {
      const raw = window.padData.rawPairs[cameraPairIdx];

      let state;
      if (raw < 680)        state = -1;
      else if (raw < 1360)  state =  0;
      else                  state =  1;

      if (state !== window.padData._lastCameraState) {
        window.padData._lastCameraState = state;

        const angleMap = { '-1': 0, '0': 20, '1': 35 };
        const angle = angleMap[String(state)];

        if (window.setCameraAngle) window.setCameraAngle(angle);

        const camEl = document.getElementById('camAngle');
        if (camEl) camEl.textContent = angle + '°';
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
// SCHEMAT PADA (SVG)
// ================================================================
function renderPadSchemeInto(containerId, highlight) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const leftActive  = highlight === 'left';
  const rightActive = highlight === 'right';

  const lc = leftActive ? '#ff0' : '#444';
  const rc = rightActive ? '#ff0' : '#444';
  const lFill = leftActive ? '#ff0' : '#555';
  const rFill = rightActive ? '#ff0' : '#555';
  const lTxt = leftActive ? '#ff0' : '#888';
  const rTxt = rightActive ? '#ff0' : '#888';

  const leftLabel = t('pad_scheme.left_stick');
  const rightLabel = t('pad_scheme.right_stick');
  const modeText = t('pad_scheme.mode');
  const footerText = t('pad_scheme.footer');

  container.innerHTML = `
    <svg viewBox="0 0 460 300" width="520" height="340">
      <rect x="10" y="10" width="440" height="280" rx="20"
            fill="#0a0a0a" stroke="#0f0" stroke-width="2"/>

      <text x="230" y="42" text-anchor="middle"
            font-family="monospace" font-size="20" font-weight="bold"
            fill="#0ff" letter-spacing="3">${modeText}</text>

      <text x="230" y="62" text-anchor="middle"
            font-family="monospace" font-size="11"
            fill="#0f0" opacity="0.55">BetaFPV LiteRadio 2 SE</text>

      <!-- ─── LEWY DRĄŻEK ─── -->
      <g transform="translate(130,190)">
        <text x="0" y="-80" text-anchor="middle"
              font-family="monospace" font-size="15" font-weight="bold"
              fill="${lTxt}" letter-spacing="1.5">THROTTLE</text>

        <text x="-85" y="6" text-anchor="middle"
              font-family="monospace" font-size="15" font-weight="bold"
              fill="${lTxt}" letter-spacing="1.5">YAW</text>

        <circle r="52" fill="#111" stroke="${lc}" stroke-width="${leftActive ? 3 : 1.5}"
                ${leftActive ? 'filter="drop-shadow(0 0 8px #ff0)"' : ''}/>
        <circle r="38" fill="#1a1a1a" stroke="${leftActive ? '#ff0' : '#333'}" stroke-width="1"/>
        <circle r="16" fill="${lFill}" opacity="${leftActive ? 1 : 0.7}"/>
      </g>

      <!-- ─── PRAWY DRĄŻEK ─── -->
      <g transform="translate(330,190)">
        <text x="0" y="-80" text-anchor="middle"
              font-family="monospace" font-size="15" font-weight="bold"
              fill="${rTxt}" letter-spacing="1.5">PITCH</text>

        <text x="85" y="6" text-anchor="middle"
              font-family="monospace" font-size="15" font-weight="bold"
              fill="${rTxt}" letter-spacing="1.5">ROLL</text>

        <circle r="52" fill="#111" stroke="${rc}" stroke-width="${rightActive ? 3 : 1.5}"
                ${rightActive ? 'filter="drop-shadow(0 0 8px #ff0)"' : ''}/>
        <circle r="38" fill="#1a1a1a" stroke="${rightActive ? '#ff0' : '#333'}" stroke-width="1"/>
        <circle r="16" fill="${rFill}" opacity="${rightActive ? 1 : 0.7}"/>
      </g>

      <text x="230" y="278" text-anchor="middle"
            font-family="monospace" font-size="10"
            fill="#0f0" opacity="0.5">${footerText}</text>
    </svg>
  `;
}

function renderPadScheme(highlight) {
  renderPadSchemeInto('pad-scheme', highlight);
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
  if (!container) return;
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

  renderPadSchemeInto('pad-scheme-mapping', null);
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

    const valEl = document.getElementById(`axis-val-${i}`);
    if (valEl) valEl.textContent = v;

    const pct = Math.max(0, Math.min(100, (v / 2047) * 100));
    const fill = document.getElementById(`axis-fill-${i}`);
    if (fill) {
      fill.style.left = '0%';
      fill.style.width = pct + '%';
    }
  }
}

function updateAxisStatus(i) {
  const sel = mappingState.assignments[i];
  const sta = document.getElementById(`axis-sta-${i}`);
  if (!sta) return;
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
    alert(t('alerts.missing_functions', { list: missing.join(', ') }));
    return;
  }

  calibState = {
    assignedPairs: assignedPairs,
    queue: [...CALIB_ORDER],
    current: null,
    duration: CALIB_DURATION_MS,
    startTime: 0,
    min: 99999,
    max: -1,
    results: {},
    retryCount: 0
  };

  showStep('step-calib');
  nextCalibrationStep();
}

function nextCalibrationStep() {
  if (!calibState) return;

  if (calibState.queue.length === 0) {
    finishCalibration();
    return;
  }

  calibState.current = calibState.queue.shift();
  calibState.startTime = performance.now();
  calibState.min = 99999;
  calibState.max = -1;

  const instrEl = document.getElementById('calib-instruction');
  if (instrEl) instrEl.innerHTML = t(`calib.${calibState.current}`);
  const fillEl = document.getElementById('calib-progress-fill');
  if (fillEl) fillEl.style.width = '0%';
  const valuesEl = document.getElementById('calib-values');
  if (valuesEl) valuesEl.textContent = t('calib.moving');
  const errEl = document.getElementById('calib-error');
  if (errEl) errEl.style.display = 'none';

  renderPadScheme(STICK_FOR_FN[calibState.current]);
}

function updateCalibration() {
  if (!calibState || !calibState.current) return;

  const pairIdx = calibState.assignedPairs[calibState.current];
  const v = window.padData.rawPairs[pairIdx];

  if (v < calibState.min) calibState.min = v;
  if (v > calibState.max) calibState.max = v;

  const elapsed = performance.now() - calibState.startTime;
  const remaining = Math.max(0, calibState.duration - elapsed);
  const pct = Math.min(100, (elapsed / calibState.duration) * 100);

  const fillEl = document.getElementById('calib-progress-fill');
  if (fillEl) fillEl.style.width = pct + '%';

  const timerEl = document.getElementById('calib-timer');
  if (timerEl) timerEl.textContent = t('calib.remaining') + (remaining / 1000).toFixed(1) + t('calib.seconds');

  const valuesEl = document.getElementById('calib-values');
  if (valuesEl) {
    valuesEl.textContent =
      `${calibState.current.toUpperCase()} (P${pairIdx})  min=${calibState.min}  max=${calibState.max}  range=${calibState.max - calibState.min}`;
  }

  if (elapsed >= calibState.duration) {
    const range = calibState.max - calibState.min;

    if (range < CALIB_MIN_RANGE) {
      const errEl = document.getElementById('calib-error');
      if (errEl) {
        errEl.style.display = 'block';
        errEl.innerHTML =
          t('calib.range_too_small', {
            range: range,
            min: CALIB_MIN_RANGE,
            fn: calibState.current.toUpperCase()
          }) +
          `<button id="btn-calib-retry" style="margin-top:10px;">${t('calib.btn_retry')}</button>`;

        document.getElementById('btn-calib-retry').addEventListener('click', () => {
          calibState.queue.unshift(calibState.current);
          nextCalibrationStep();
        });
      }

      calibState.current = null;
      return;
    }

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
  saveCalibrationToStorage(map);

  calibState = null;
  renderPadScheme(null);
  showStep('step-done');
}

// ================================================================
// localStorage
// ================================================================
function saveCalibrationToStorage(map) {
  try {
    const payload = { timestamp: Date.now(), map: {} };
    for (const fn of CALIB_ORDER) {
      payload.map[fn] = {
        min: map[fn].min,
        max: map[fn].max,
        center: map[fn].center,
        inverted: map[fn].inverted
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('⚠️ Nie udało się zapisać kalibracji:', e);
  }
}

function loadCalibrationFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.map) return null;
    const age = Date.now() - data.timestamp;
    if (age > STORAGE_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch (e) {
    return null;
  }
}

function applySavedCalibration(saved, assignedPairs) {
  const map = {};
  for (const fn of CALIB_ORDER) {
    const savedFn = saved.map[fn];
    if (!savedFn) return false;
    map[fn] = {
      pair: assignedPairs[fn],
      min: savedFn.min,
      max: savedFn.max,
      center: savedFn.center,
      inverted: savedFn.inverted
    };
  }
  window.padData.profile = { map: map };
  return true;
}

// ================================================================
// KĄT KAMERY — klawisz K / przełącznik CAMERA
// ================================================================
window.cameraAngles = [0, 20, 35];
window.cameraAngleIndex = 0;

window.cycleCameraAngle = function() {
  window.cameraAngleIndex = (window.cameraAngleIndex + 1) % window.cameraAngles.length;
  const angle = window.cameraAngles[window.cameraAngleIndex];

  const camEl = document.getElementById('camAngle');
  if (camEl) camEl.textContent = angle + '°';

  if (window.onCameraAngleChange) window.onCameraAngleChange(angle);
};

window.setCameraAngle = function(angleDeg) {
  const camEl = document.getElementById('camAngle');
  if (camEl) camEl.textContent = angleDeg + '°';

  if (window.onCameraAngleChange) window.onCameraAngleChange(angleDeg);
};

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

      let attempts = 0;
      const maxAttempts = 50;

      const waitForSimulator = () => {
        if (window.startSimulator) {
          window.startSimulator(world);
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(waitForSimulator, 100);
        } else {
          alert(t('alerts.sim_not_ready'));
        }
      };

      waitForSimulator();
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
  status.textContent = t('connect.status_connecting');
  status.style.color = '#ff0';

  const dev = await connectPad(true);

  if (dev) {
    status.textContent = t('connect.status_connected') + dev.productName;
    status.style.color = '#0f0';
    setTimeout(() => {
      initMappingUI();
      showStep('step-mapping');
    }, 500);
  } else {
    status.textContent = t('connect.status_failed');
    status.style.color = '#f44';
  }
});

document.getElementById('btn-mapping-next').addEventListener('click', () => {
  const assigned = mappingState.assignments.filter(a => a !== '---');
  if (assigned.length < 4) {
    alert(t('alerts.missing_4', { count: assigned.length }));
    return;
  }

  const assignedPairs = {};
  for (let i = 0; i < 8; i++) {
    const fn = mappingState.assignments[i];
    if (fn !== '---' && !assignedPairs[fn]) assignedPairs[fn] = i;
  }

  const sessionPadId = sessionStorage.getItem(SESSION_PAD_KEY);
  const currentPadId = window.padData.device
    ? (window.padData.device.productName + '|' + window.padData.device.vendorId + '|' + window.padData.device.productId)
    : null;

  const saved = loadCalibrationFromStorage();

  if (saved && sessionPadId && currentPadId && sessionPadId === currentPadId) {
    if (applySavedCalibration(saved, assignedPairs)) {
      showStep('step-done');
      return;
    }
  }

  startCalibration();
});

document.getElementById('btn-recalibrate').addEventListener('click', () => {
  showOverlay();
  showStep('step-start');
});

document.getElementById('menuBtn').addEventListener('click', () => {
  if (window.stopSimulator) window.stopSimulator();
  showOverlay();
  showStep('step-done');
});

// ================================================================
// ROZŁĄCZENIE PADA
// ================================================================
document.getElementById('btn-reconnect').addEventListener('click', async () => {
  const dev = await connectPad(true);
  if (dev) {
    const banner = document.getElementById('reconnectBanner');
    if (banner) banner.classList.remove('show');
    if (window.padData.onReconnect) window.padData.onReconnect();
  }
});

window.padData.onDisconnect = () => {
  const banner = document.getElementById('reconnectBanner');
  if (banner) banner.classList.add('show');
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = t('hud.disconnected');
  const hud = document.getElementById('hud');
  if (hud) hud.classList.add('paused');
};

window.padData.onReconnect = () => {
  const banner = document.getElementById('reconnectBanner');
  if (banner) banner.classList.remove('show');
  const statusEl = document.getElementById('status');
  if (statusEl) statusEl.textContent = t('hud.ok');
  const hud = document.getElementById('hud');
  if (hud) hud.classList.remove('paused');
};

// ================================================================
// AUTO-POŁĄCZENIE
// ================================================================
(async () => {
  const dev = await connectPad(false);
  if (dev) console.log('✅ Auto-połączono z padem');
})();

// ================================================================
// REAKCJA NA ZMIANĘ JĘZYKA (odśwież schemat pada)
// ================================================================
window.addEventListener('langchange', () => {
  // Odśwież schemat pada z nowymi tłumaczeniami
  if (document.getElementById('pad-scheme-mapping')) {
    renderPadSchemeInto('pad-scheme-mapping', null);
  }
  if (document.getElementById('pad-scheme') && calibState) {
    renderPadScheme(STICK_FOR_FN[calibState.current]);
  }
});