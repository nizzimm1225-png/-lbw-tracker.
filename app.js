'use strict';

const $ = (id) => document.getElementById(id);

const els = {
  camera: $('camera'),
  cameraPlaceholder: $('cameraPlaceholder'),
  startCameraBtn: $('startCameraBtn'),
  reviewBtn: $('reviewBtn'),
  reviewSubtext: $('reviewSubtext'),
  statusPill: $('statusPill'),
  statusText: $('statusText'),
  liveBadge: $('liveBadge'),
  fpsBadge: $('fpsBadge'),
  bufferBadge: $('bufferBadge'),
  clockBadge: $('clockBadge'),
  reviewProgress: $('reviewProgress'),
  reviewCountdown: $('reviewCountdown'),
  reviewProgressBar: $('reviewProgressBar'),
  preStat: $('preStat'),
  postStat: $('postStat'),
  savedCountStat: $('savedCountStat'),
  reviewsEmpty: $('reviewsEmpty'),
  reviewsList: $('reviewsList'),
  refreshReviewsBtn: $('refreshReviewsBtn'),
  bufferSeconds: $('bufferSeconds'),
  preSeconds: $('preSeconds'),
  postSeconds: $('postSeconds'),
  frameRate: $('frameRate'),
  maxReviews: $('maxReviews'),
  switchCameraBtn: $('switchCameraBtn'),
  stopCameraBtn: $('stopCameraBtn'),
  deleteAllBtn: $('deleteAllBtn'),
  playerSheet: $('playerSheet'),
  playerTitle: $('playerTitle'),
  reviewPlayer: $('reviewPlayer'),
  reviewNotes: $('reviewNotes'),
  saveMetadataBtn: $('saveMetadataBtn'),
  shareClipBtn: $('shareClipBtn'),
  deleteClipBtn: $('deleteClipBtn'),
  toast: $('toast')
};

const DEFAULTS = {
  bufferSeconds: 30,
  preSeconds: 8,
  postSeconds: 5,
  frameRate: 60,
  maxReviews: 20
};

const state = {
  stream: null,
  recorder: null,
  mimeType: '',
  chunks: [], // { blob, ts, seq }
  seq: 0,
  firstChunk: null,
  mp4InitSegment: null,
  reviewCapture: null,
  facingMode: 'environment',
  cameraStartedAt: null,
  clockTimer: null,
  reviewTimer: null,
  reviewFinalizeTimer: null,
  currentReview: null,
  currentReviewUrl: null,
  selectedDecision: '',
  wakeLock: null,
  settings: loadSettings()
};

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('lbwSettings') || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  localStorage.setItem('lbwSettings', JSON.stringify(state.settings));
}

function applySettingsToUI() {
  for (const key of Object.keys(DEFAULTS)) {
    if (els[key]) els[key].value = String(state.settings[key]);
  }
  els.bufferBadge.textContent = `Buffer ${state.settings.bufferSeconds}s`;
  els.preStat.textContent = `${state.settings.preSeconds}s`;
  els.postStat.textContent = `${state.settings.postSeconds}s`;
  if (state.stream && !state.reviewCapture) {
    els.reviewSubtext.textContent = `Saves ${state.settings.preSeconds}s before + ${state.settings.postSeconds}s after`;
  }
}

function setStatus(kind, text) {
  els.statusPill.className = `status-pill ${kind}`;
  els.statusText.textContent = text;
}

let toastTimer;
function showToast(message, ms = 2600) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), ms);
}

function pad2(n) { return String(n).padStart(2, '0'); }
function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}
function formatDate(ts) {
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(ts));
}
function safeFileDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}_${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
}

function pickMimeType() {
  const candidates = [
    'video/mp4;codecs="avc1.42E01E"',
    'video/mp4;codecs=h264',
    'video/mp4',
    'video/webm;codecs=vp8',
    'video/webm'
  ];
  if (!window.MediaRecorder) return '';
  if (!MediaRecorder.isTypeSupported) return 'video/mp4';
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
  } catch { /* optional enhancement */ }
}

async function startCamera() {
  if (state.stream) return;
  if (!window.isSecureContext) {
    setStatus('error', 'HTTPS required');
    showToast('Camera access requires an HTTPS website.', 4500);
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    setStatus('error', 'Unsupported');
    showToast('This browser does not expose the required camera recording APIs.', 4500);
    return;
  }

  setStatus('reviewing', 'Starting…');
  els.startCameraBtn.disabled = true;

  const targetFps = Number(state.settings.frameRate);
  const videoConstraints = {
    facingMode: { ideal: state.facingMode },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: targetFps, max: targetFps }
  };

  try {
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    } catch (firstError) {
      console.warn('Preferred constraints failed; retrying with basic camera constraints.', firstError);
      state.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: state.facingMode } },
        audio: false
      });
    }

    els.camera.srcObject = state.stream;
    await els.camera.play();

    const track = state.stream.getVideoTracks()[0];
    const actual = track?.getSettings?.() || {};
    els.fpsBadge.textContent = actual.frameRate ? `${Math.round(actual.frameRate)} fps` : `${targetFps} fps pref.`;

    state.mimeType = pickMimeType();
    const options = {};
    if (state.mimeType) options.mimeType = state.mimeType;
    options.videoBitsPerSecond = 4_000_000;

    try {
      state.recorder = new MediaRecorder(state.stream, options);
    } catch {
      delete options.videoBitsPerSecond;
      state.recorder = state.mimeType ? new MediaRecorder(state.stream, { mimeType: state.mimeType }) : new MediaRecorder(state.stream);
    }

    state.mimeType = state.recorder.mimeType || state.mimeType || 'video/mp4';
    state.chunks = [];
    state.seq = 0;
    state.firstChunk = null;
    state.mp4InitSegment = null;

    state.recorder.ondataavailable = handleRecorderData;
    state.recorder.onerror = event => {
      console.error('MediaRecorder error', event.error || event);
      setStatus('error', 'Recorder error');
      showToast('Recording encountered an error. Restart the camera.', 4000);
    };
    state.recorder.onstop = () => {
      if (state.stream) return;
      setStatus('idle', 'Idle');
    };

    // One-second chunks are documented by WebKit and give a practical rolling buffer.
    state.recorder.start(1000);
    state.cameraStartedAt = Date.now();
    state.clockTimer = setInterval(() => {
      els.clockBadge.textContent = formatClock(Date.now() - state.cameraStartedAt);
    }, 1000);

    els.cameraPlaceholder.classList.add('hidden');
    els.liveBadge.classList.remove('hidden');
    els.reviewBtn.disabled = false;
    els.switchCameraBtn.disabled = false;
    els.stopCameraBtn.disabled = false;
    els.reviewSubtext.textContent = `Saves ${state.settings.preSeconds}s before + ${state.settings.postSeconds}s after`;
    setStatus('live', 'Live');
    await requestWakeLock();
  } catch (error) {
    console.error(error);
    state.stream = null;
    setStatus('error', 'Camera blocked');
    els.startCameraBtn.disabled = false;
    const message = error?.name === 'NotAllowedError'
      ? 'Camera permission was denied. Allow camera access in Safari settings and try again.'
      : `Could not start camera: ${error?.message || 'unknown error'}`;
    showToast(message, 5500);
  }
}

function handleRecorderData(event) {
  if (!event.data || event.data.size === 0) return;
  const chunk = { blob: event.data, ts: Date.now(), seq: state.seq++ };
  if (!state.firstChunk) {
    state.firstChunk = chunk;
    if ((state.mimeType || '').includes('mp4')) {
      extractMp4InitSegment(event.data).then(init => { if (init?.size) state.mp4InitSegment = init; }).catch(() => {});
    }
  }

  state.chunks.push(chunk);
  pruneRollingBuffer();

  if (state.reviewCapture && chunk.seq > state.reviewCapture.lastSeq) {
    state.reviewCapture.chunks.push(chunk);
    state.reviewCapture.lastSeq = chunk.seq;
  }
}

function pruneRollingBuffer() {
  const keepMs = (Number(state.settings.bufferSeconds) + 3) * 1000;
  const cutoff = Date.now() - keepMs;
  state.chunks = state.chunks.filter(chunk => chunk.ts >= cutoff);
}

async function extractMp4InitSegment(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  const initParts = [];
  while (offset + 8 <= bytes.length) {
    let size = new DataView(buffer, offset, 4).getUint32(0);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    let header = 8;
    if (size === 1 && offset + 16 <= bytes.length) {
      const dv = new DataView(buffer, offset + 8, 8);
      const high = dv.getUint32(0);
      const low = dv.getUint32(4);
      size = high * 2 ** 32 + low;
      header = 16;
    } else if (size === 0) {
      size = bytes.length - offset;
    }
    if (!Number.isFinite(size) || size < header || offset + size > bytes.length) break;
    if (type === 'ftyp' || type === 'moov') initParts.push(bytes.slice(offset, offset + size));
    if (type === 'moof' || type === 'mdat') break;
    offset += size;
  }
  return initParts.length ? new Blob(initParts, { type: state.mimeType || 'video/mp4' }) : null;
}

function triggerReview() {
  if (!state.recorder || state.recorder.state !== 'recording' || state.reviewCapture) return;

  const eventTs = Date.now();
  const preMs = Number(state.settings.preSeconds) * 1000;
  const postMs = Number(state.settings.postSeconds) * 1000;
  const cutoff = eventTs - preMs - 500; // one chunk tolerance
  const selected = state.chunks.filter(chunk => chunk.ts >= cutoff);

  if (!selected.length) {
    showToast('The rolling buffer is still warming up. Try again in a moment.');
    return;
  }

  state.reviewCapture = {
    eventTs,
    endTs: eventTs + postMs,
    chunks: [...selected],
    lastSeq: selected[selected.length - 1].seq
  };

  els.reviewBtn.disabled = true;
  els.reviewProgress.classList.remove('hidden');
  setStatus('reviewing', 'Review capture');

  const updateProgress = () => {
    if (!state.reviewCapture) return;
    const remaining = Math.max(0, state.reviewCapture.endTs - Date.now());
    const elapsed = postMs - remaining;
    els.reviewCountdown.textContent = `${Math.ceil(remaining / 1000)}s`;
    els.reviewProgressBar.style.width = `${Math.min(100, (elapsed / postMs) * 100)}%`;
  };
  updateProgress();
  state.reviewTimer = setInterval(updateProgress, 150);

  state.reviewFinalizeTimer = setTimeout(() => {
    try { if (state.recorder?.state === 'recording') state.recorder.requestData(); } catch { /* no-op */ }
    setTimeout(finalizeReview, 500);
  }, postMs);
}

async function finalizeReview() {
  if (!state.reviewCapture) return;
  clearInterval(state.reviewTimer);
  clearTimeout(state.reviewFinalizeTimer);

  const capture = state.reviewCapture;
  state.reviewCapture = null;
  const maxTs = capture.endTs + 1300;
  let chunks = capture.chunks.filter(chunk => chunk.ts <= maxTs);
  const preTarget = capture.eventTs - Number(state.settings.preSeconds) * 1000;
  chunks = chunks.filter((chunk, index) => chunk.ts >= preTarget - 1300 || index === 0);

  if (!chunks.length) {
    restoreLiveAfterReview();
    showToast('No video data was available for the review.');
    return;
  }

  const blobParts = [];
  const containsFirst = state.firstChunk && chunks.some(c => c.seq === state.firstChunk.seq);
  if (!containsFirst && state.mp4InitSegment && (state.mimeType || '').includes('mp4')) {
    blobParts.push(state.mp4InitSegment);
  }
  blobParts.push(...chunks.map(c => c.blob));

  const blob = new Blob(blobParts, { type: state.mimeType || chunks[0].blob.type || 'video/mp4' });
  const record = {
    id: crypto.randomUUID ? crypto.randomUUID() : `review-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: capture.eventTs,
    savedAt: Date.now(),
    mimeType: blob.type || state.mimeType || 'video/mp4',
    durationSec: Number(state.settings.preSeconds) + Number(state.settings.postSeconds),
    preSeconds: Number(state.settings.preSeconds),
    postSeconds: Number(state.settings.postSeconds),
    decision: '',
    notes: '',
    size: blob.size,
    blob
  };

  try {
    await dbPut(record);
    await enforceReviewLimit();
    await refreshReviews();
    restoreLiveAfterReview();
    showToast('LBW review saved on this iPhone.');
    if ('vibrate' in navigator) navigator.vibrate?.([40, 50, 80]);
  } catch (error) {
    console.error(error);
    restoreLiveAfterReview();
    showToast('Could not save the clip. Browser storage may be full.', 5000);
  }
}

function restoreLiveAfterReview() {
  els.reviewProgress.classList.add('hidden');
  els.reviewProgressBar.style.width = '0%';
  els.reviewBtn.disabled = !state.stream;
  els.reviewSubtext.textContent = state.stream
    ? `Saves ${state.settings.preSeconds}s before + ${state.settings.postSeconds}s after`
    : 'Start camera first';
  if (state.stream) setStatus('live', 'Live');
}

async function stopCamera() {
  clearInterval(state.clockTimer);
  clearInterval(state.reviewTimer);
  clearTimeout(state.reviewFinalizeTimer);
  state.reviewCapture = null;

  if (state.recorder && state.recorder.state !== 'inactive') {
    try { state.recorder.stop(); } catch { /* no-op */ }
  }
  state.stream?.getTracks?.().forEach(track => track.stop());
  state.stream = null;
  state.recorder = null;
  state.chunks = [];
  state.firstChunk = null;
  state.mp4InitSegment = null;
  els.camera.srcObject = null;
  els.cameraPlaceholder.classList.remove('hidden');
  els.startCameraBtn.disabled = false;
  els.liveBadge.classList.add('hidden');
  els.reviewBtn.disabled = true;
  els.switchCameraBtn.disabled = true;
  els.stopCameraBtn.disabled = true;
  els.reviewProgress.classList.add('hidden');
  els.reviewSubtext.textContent = 'Start camera first';
  els.clockBadge.textContent = '00:00';
  els.fpsBadge.textContent = '— fps';
  setStatus('idle', 'Idle');
  try { await state.wakeLock?.release?.(); } catch { /* no-op */ }
  state.wakeLock = null;
}

async function switchCamera() {
  state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
  await stopCamera();
  await startCamera();
}

// IndexedDB -----------------------------------------------------------------
const DB_NAME = 'lbwTrackerDB';
const DB_VERSION = 1;
const STORE = 'reviews';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPut(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function dbGet(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
    req.onsuccess = () => { const value = req.result; db.close(); resolve(value); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => { const value = req.result || []; db.close(); resolve(value); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function dbClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function enforceReviewLimit() {
  const reviews = (await dbGetAll()).sort((a, b) => b.createdAt - a.createdAt);
  const max = Number(state.settings.maxReviews);
  for (const review of reviews.slice(max)) await dbDelete(review.id);
}

async function refreshReviews() {
  const reviews = (await dbGetAll()).sort((a, b) => b.createdAt - a.createdAt);
  els.savedCountStat.textContent = String(reviews.length);
  els.reviewsEmpty.classList.toggle('hidden', reviews.length > 0);
  els.reviewsList.innerHTML = '';

  for (const review of reviews) {
    const card = document.createElement('article');
    card.className = 'review-card';
    const decision = review.decision || 'UNREVIEWED';
    const chipClass = decision === 'OUT' ? 'out' : decision === 'NOT OUT' ? 'not-out' : decision === 'CHECKING' ? 'checking' : '';
    const mb = review.size ? `${(review.size / 1024 / 1024).toFixed(1)} MB` : '';
    card.innerHTML = `
      <button class="review-open" data-id="${review.id}">
        <div class="review-card-top">
          <div>
            <h3>${escapeHtml(formatDate(review.createdAt))}</h3>
            <div class="review-meta">≈ ${review.durationSec}s · ${escapeHtml(mb)} · ${review.preSeconds}s before / ${review.postSeconds}s after</div>
          </div>
          <span class="decision-chip ${chipClass}">${escapeHtml(decision)}</span>
        </div>
      </button>`;
    card.querySelector('.review-open').addEventListener('click', () => openReview(review.id));
    els.reviewsList.appendChild(card);
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[ch]));
}

async function openReview(id) {
  const review = await dbGet(id);
  if (!review) return;
  state.currentReview = review;
  state.selectedDecision = review.decision || '';
  if (state.currentReviewUrl) URL.revokeObjectURL(state.currentReviewUrl);
  state.currentReviewUrl = URL.createObjectURL(review.blob);
  els.reviewPlayer.src = state.currentReviewUrl;
  els.reviewPlayer.playbackRate = 1;
  els.playerTitle.textContent = formatDate(review.createdAt);
  els.reviewNotes.value = review.notes || '';
  document.querySelectorAll('.speed').forEach(btn => btn.classList.toggle('active', btn.dataset.speed === '1'));
  document.querySelectorAll('.decision').forEach(btn => btn.classList.toggle('active', btn.dataset.decision === state.selectedDecision));
  els.playerSheet.classList.remove('hidden');
}

function closeReview() {
  els.reviewPlayer.pause();
  els.reviewPlayer.removeAttribute('src');
  els.reviewPlayer.load();
  if (state.currentReviewUrl) URL.revokeObjectURL(state.currentReviewUrl);
  state.currentReviewUrl = null;
  state.currentReview = null;
  state.selectedDecision = '';
  els.playerSheet.classList.add('hidden');
}

async function saveReviewMetadata() {
  if (!state.currentReview) return;
  state.currentReview.decision = state.selectedDecision;
  state.currentReview.notes = els.reviewNotes.value.trim();
  await dbPut(state.currentReview);
  await refreshReviews();
  showToast('Decision and note saved.');
}

async function shareCurrentClip() {
  if (!state.currentReview) return;
  const ext = (state.currentReview.mimeType || '').includes('webm') ? 'webm' : 'mp4';
  const file = new File(
    [state.currentReview.blob],
    `LBW-Review-${safeFileDate(state.currentReview.createdAt)}.${ext}`,
    { type: state.currentReview.mimeType || `video/${ext}` }
  );
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: 'LBW Review',
        text: state.currentReview.decision ? `LBW decision: ${state.currentReview.decision}` : 'LBW review clip',
        files: [file]
      });
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
    console.warn('Share failed, falling back to download', error);
  }

  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('Clip prepared for download.');
}

async function deleteCurrentClip() {
  if (!state.currentReview) return;
  if (!confirm('Delete this saved LBW review?')) return;
  const id = state.currentReview.id;
  closeReview();
  await dbDelete(id);
  await refreshReviews();
  showToast('Review deleted.');
}

// UI wiring ------------------------------------------------------------------
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === id));
  if (id === 'reviewsView') refreshReviews().catch(console.error);
}

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.view)));
els.startCameraBtn.addEventListener('click', startCamera);
els.reviewBtn.addEventListener('click', triggerReview);
els.stopCameraBtn.addEventListener('click', stopCamera);
els.switchCameraBtn.addEventListener('click', switchCamera);
els.refreshReviewsBtn.addEventListener('click', () => refreshReviews().catch(console.error));

for (const key of ['bufferSeconds','preSeconds','postSeconds','frameRate','maxReviews']) {
  els[key].addEventListener('change', async () => {
    state.settings[key] = Number(els[key].value);
    if (key === 'preSeconds' && state.settings.preSeconds > state.settings.bufferSeconds) {
      state.settings.bufferSeconds = Math.max(15, state.settings.preSeconds);
      els.bufferSeconds.value = String(state.settings.bufferSeconds);
    }
    saveSettings();
    applySettingsToUI();
    pruneRollingBuffer();
    if (key === 'frameRate' && state.stream) showToast('Restart the camera to apply the new frame rate.');
    if (key === 'maxReviews') { await enforceReviewLimit(); await refreshReviews(); }
  });
}

document.querySelectorAll('[data-close-sheet]').forEach(el => el.addEventListener('click', closeReview));
document.querySelectorAll('.speed').forEach(btn => btn.addEventListener('click', () => {
  const speed = Number(btn.dataset.speed);
  els.reviewPlayer.playbackRate = speed;
  document.querySelectorAll('.speed').forEach(b => b.classList.toggle('active', b === btn));
}));
document.querySelectorAll('.decision').forEach(btn => btn.addEventListener('click', () => {
  state.selectedDecision = btn.dataset.decision;
  document.querySelectorAll('.decision').forEach(b => b.classList.toggle('active', b === btn));
}));
els.saveMetadataBtn.addEventListener('click', () => saveReviewMetadata().catch(console.error));
els.shareClipBtn.addEventListener('click', () => shareCurrentClip().catch(console.error));
els.deleteClipBtn.addEventListener('click', () => deleteCurrentClip().catch(console.error));
els.deleteAllBtn.addEventListener('click', async () => {
  const reviews = await dbGetAll();
  if (!reviews.length) { showToast('There are no saved reviews.'); return; }
  if (!confirm(`Delete all ${reviews.length} saved LBW reviews from this iPhone?`)) return;
  await dbClear();
  await refreshReviews();
  showToast('All saved reviews deleted.');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.stream) requestWakeLock();
  if (document.visibilityState === 'hidden' && state.reviewCapture) {
    // iOS may suspend camera recording in the background; warn when the user comes back.
    localStorage.setItem('lbwWasReviewingWhenHidden', '1');
  }
  if (document.visibilityState === 'visible' && localStorage.getItem('lbwWasReviewingWhenHidden') === '1') {
    localStorage.removeItem('lbwWasReviewingWhenHidden');
    showToast('Keep LBW Tracker in the foreground while a review clip is being captured.', 5000);
  }
});

window.addEventListener('pagehide', () => {
  try { state.wakeLock?.release?.(); } catch { /* no-op */ }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}

applySettingsToUI();
refreshReviews().catch(console.error);
setStatus('idle', 'Idle');
