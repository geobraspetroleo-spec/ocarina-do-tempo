const songs = [
  { id: 'zelda', name: 'Zelda’s Lullaby', notes: ['L', 'U', 'R', 'L', 'U', 'R'], description: 'A melody passed down through Hyrule’s royal family.' },
  { id: 'epona', name: 'Epona’s Song', notes: ['U', 'L', 'R', 'U', 'L', 'R'], description: 'A familiar tune from the quiet pastures of Lon Lon Ranch.' },
  { id: 'saria', name: 'Saria’s Song', notes: ['D', 'R', 'L', 'D', 'R', 'L'], description: 'A song of friendship, deep in the Lost Woods.' },
  { id: 'sun', name: 'Sun’s Song', notes: ['R', 'D', 'U', 'R', 'D', 'U'], description: 'A little melody to greet the dawn, or welcome the night.' },
  { id: 'time', name: 'Song of Time', notes: ['R', 'A', 'D', 'R', 'A', 'D'], description: 'Let the echoes of the Temple of Time find you.' },
  { id: 'storms', name: 'Song of Storms', notes: ['A', 'D', 'U', 'A', 'D', 'U'], description: 'The windmill turns. A storm is on its way.' },
  { id: 'minuet', name: 'Minuet of Forest', notes: ['A', 'U', 'L', 'R', 'L', 'R'], description: 'Find your way back to the heart of the forest.' },
  { id: 'bolero', name: 'Bolero of Fire', notes: ['D', 'A', 'D', 'A', 'R', 'D', 'R', 'D'], description: 'A steady rhythm for the depths of Death Mountain.' },
  { id: 'serenade', name: 'Serenade of Water', notes: ['A', 'D', 'R', 'R', 'L'], description: 'A gentle refrain beneath the waters of Lake Hylia.' },
  { id: 'requiem', name: 'Requiem of Spirit', notes: ['A', 'D', 'A', 'R', 'D', 'A'], description: 'An ancient melody carried across the desert sands.' },
  { id: 'nocturne', name: 'Nocturne of Shadow', notes: ['L', 'R', 'R', 'A', 'L', 'R', 'D'], description: 'A haunting passage into Kakariko’s hidden shadows.' },
  { id: 'prelude', name: 'Prelude of Light', notes: ['U', 'R', 'U', 'R', 'L', 'U'], description: 'A guiding light, and a melody that brings you home.' }
];
const noteInfo = {
  A: { symbol: 'A', pitch: 'D4', frequency: 293.6648, label: 'A' },
  D: { symbol: '↓', pitch: 'F4', frequency: 349.2282, label: 'Down' },
  R: { symbol: '→', pitch: 'A4', frequency: 440, label: 'Right' },
  L: { symbol: '←', pitch: 'B4', frequency: 493.8833, label: 'Left' },
  U: { symbol: '↑', pitch: 'D5', frequency: 587.3295, label: 'Up' }
};
const $ = (selector) => document.querySelector(selector);
let selected = songs[0];
let history = [];
let progress = 0;
let audio;
let master;
let muted = false;
let demoRunning = false;
let demoTimers = [];
let tapId = 0;
const voices = new Map();
const learned = new Set();
const noteButtons = [...document.querySelectorAll('button[data-note]')];

function setStatus(message) { $('#status').textContent = message; }
function updateVolume() {
  if (master) master.gain.setTargetAtTime(muted ? 0 : Number($('#volume').value) / 100 * 0.28, audio.currentTime, 0.025);
}
function ensureAudio() {
  if (!audio) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Audio is unavailable');
    audio = new AudioContextClass();
    master = audio.createGain();
    master.connect(audio.destination);
    updateVolume();
  }
  if (audio.state === 'suspended') audio.resume().catch(() => setStatus('Sound is paused by your browser. Try tapping a note again.'));
}
function createTone(note) {
  try {
    ensureAudio();
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const envelope = audio.createGain();
    const vibrato = audio.createOscillator();
    const vibratoDepth = audio.createGain();
    oscillator.setPeriodicWave(audio.createPeriodicWave(new Float32Array([0, 0, 0, 0]), new Float32Array([0, 1, .065, .025])));
    oscillator.frequency.value = noteInfo[note].frequency;
    vibrato.frequency.value = 4.8;
    vibratoDepth.gain.setValueAtTime(0, now);
    vibratoDepth.gain.linearRampToValueAtTime(1.6, now + .4);
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(oscillator.frequency);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(.85, now + .035);
    envelope.gain.linearRampToValueAtTime(.65, now + .15);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start();
    vibrato.start();
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      const end = audio.currentTime;
      envelope.gain.cancelScheduledValues(end);
      envelope.gain.setTargetAtTime(0, end, .035);
      oscillator.stop(end + .18);
      vibrato.stop(end + .18);
      oscillator.onended = () => {
        oscillator.disconnect(); envelope.disconnect(); vibrato.disconnect(); vibratoDepth.disconnect();
      };
    };
  } catch (error) {
    setStatus('Audio is not available in this browser. You can still practice the note sequences.');
    return () => {};
  }
}
function updateActiveNotes() {
  const active = new Set([...voices.values()].map((voice) => voice.note));
  noteButtons.forEach((button) => button.classList.toggle('is-active', active.has(button.dataset.note)));
  $('.instrument').classList.toggle('is-playing', active.size > 0);
  $('#instrument-state').textContent = active.size ? [...active].map((note) => noteInfo[note].pitch).join(' + ') : 'Ready to play';
}
function release(source) {
  const voice = voices.get(source);
  if (!voice) return;
  voice.stop();
  voices.delete(source);
  updateActiveNotes();
}
function press(note, source, isDemo = false) {
  if (voices.has(source)) return;
  if (!isDemo) {
    if (demoRunning) stopDemo();
    recordNote(note);
  }
  voices.set(source, { note, stop: createTone(note) });
  updateActiveNotes();
}
function releaseAll() { [...voices.keys()].forEach(release); }
function renderProgress() {
  document.querySelectorAll('.sequence-note').forEach((element, index) => {
    element.classList.toggle('is-played', index < progress);
    element.classList.toggle('is-next', index === progress);
  });
}
function renderHistory() {
  const container = $('#played-notes');
  container.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('span');
    empty.className = 'empty-notes';
    empty.textContent = 'Every adventure begins with a note.';
    container.append(empty);
  } else {
    history.slice(-12).forEach((note) => {
      const item = document.createElement('span');
      item.className = 'played-note';
      item.textContent = noteInfo[note].symbol;
      item.setAttribute('aria-label', noteInfo[note].label);
      container.append(item);
    });
  }
}
function recordNote(note) {
  history.push(note);
  history = history.slice(-24);
  renderHistory();
  if (progress === selected.notes.length) progress = 0;
  if (note === selected.notes[progress]) {
    progress++;
    setStatus(progress === selected.notes.length ? `Beautifully played. You learned ${selected.name}!` : `${progress} of ${selected.notes.length} notes. Keep going.`);
  } else {
    // Keep the longest played suffix that is also the selected melody's opening.
    progress = 0;
    for (let length = Math.min(history.length, selected.notes.length - 1); length > 0; length--) {
      if (history.slice(-length).join(',') === selected.notes.slice(0, length).join(',')) {
        progress = length;
        break;
      }
    }
    setStatus(progress ? `A new beginning. ${progress} of ${selected.notes.length} notes.` : 'Not quite. Try again from the first note.');
  }
  renderProgress();
  const match = songs.find((song) => history.slice(-song.notes.length).join(',') === song.notes.join(','));
  if (match) {
    learned.add(match.id);
    $('#discovered').textContent = `${learned.size} / ${songs.length} learned`;
    const symbol = document.querySelector(`button[data-song="${match.id}"] .song-symbol`);
    symbol.textContent = '✓';
    if (match.id !== selected.id) setStatus(`You played ${match.name}! Choose it in the songbook to practice.`);
  }
}
function stopDemo(announce = false) {
  demoTimers.forEach(clearTimeout);
  demoTimers = [];
  [...voices.keys()].filter((key) => key.startsWith('demo-')).forEach(release);
  demoRunning = false;
  $('#listen span').textContent = 'Listen first';
  $('#listen').setAttribute('aria-label', 'Listen to the selected melody');
  if (announce) setStatus('Your turn. Follow the notes from left to right.');
  renderProgress();
}
function resetPractice() {
  stopDemo();
  releaseAll();
  progress = 0;
  history = [];
  renderHistory();
  renderProgress();
  setStatus('Follow the notes from left to right.');
}
function selectSong(song) {
  selected = song;
  $('#song-title').textContent = song.name;
  $('#song-description').textContent = song.description;
  document.querySelectorAll('.song-choice').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.song === song.id)));
  $('.song-notes').replaceChildren();
  song.notes.forEach((note, index) => {
    const item = document.createElement('span');
    item.className = `sequence-note${note === 'A' ? ' is-a' : ''}`;
    item.textContent = noteInfo[note].symbol;
    item.setAttribute('aria-label', `Note ${index + 1}: ${noteInfo[note].label}`);
    $('.song-notes').append(item);
  });
  resetPractice();
}
songs.forEach((song) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'song-choice';
  button.dataset.song = song.id;
  button.setAttribute('aria-pressed', 'false');
  const symbol = document.createElement('span');
  symbol.className = 'song-symbol';
  symbol.textContent = '♪';
  symbol.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'song-name';
  name.textContent = song.name;
  const length = document.createElement('span');
  length.className = 'song-length';
  length.textContent = `${song.notes.length} notes`;
  button.append(symbol, name, length);
  button.addEventListener('click', () => selectSong(song));
  $('#song-list').append(button);
});
noteButtons.forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    button.setPointerCapture(event.pointerId);
    press(button.dataset.note, `pointer-${event.pointerId}`);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => button.addEventListener(type, (event) => release(`pointer-${event.pointerId}`)));
  // Native keyboard and assistive-technology clicks do not have pointer events.
  button.addEventListener('click', (event) => {
    if (event.detail !== 0) return;
    const source = `tap-${tapId++}`;
    press(button.dataset.note, source);
    setTimeout(() => release(source), 400);
  });
});
const keyMap = { a: 'A', ArrowDown: 'D', ArrowRight: 'R', ArrowLeft: 'L', ArrowUp: 'U' };
window.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const note = keyMap[key];
  if (!note) return;
  event.preventDefault();
  if (!event.repeat) press(note, `key-${key}`);
});
window.addEventListener('keyup', (event) => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  if (keyMap[key]) release(`key-${key}`);
});
window.addEventListener('blur', () => { stopDemo(); releaseAll(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopDemo(); releaseAll(); }
});
$('#listen').addEventListener('click', () => {
  if (demoRunning) { stopDemo(true); return; }
  resetPractice();
  ensureAudioSafe();
  demoRunning = true;
  $('#listen span').textContent = 'Stop listening';
  $('#listen').setAttribute('aria-label', 'Stop melody playback');
  setStatus('Listen to the melody, then give it a try.');
  const phrase = [...selected.notes];
  phrase.forEach((note, index) => {
    const source = `demo-${index}`;
    demoTimers.push(setTimeout(() => {
      press(note, source, true);
      document.querySelectorAll('.sequence-note').forEach((item, position) => {
        item.classList.toggle('is-next', position === index);
        item.classList.toggle('is-played', position < index);
      });
    }, index * 520));
    demoTimers.push(setTimeout(() => release(source), index * 520 + 380));
  });
  demoTimers.push(setTimeout(() => stopDemo(true), phrase.length * 520 + 150));
});
function ensureAudioSafe() {
  try { ensureAudio(); } catch (error) { setStatus('Audio is not available in this browser. Follow the highlighted notes instead.'); }
}
$('#restart').addEventListener('click', resetPractice);
$('#clear-notes').addEventListener('click', resetPractice);
$('#volume').addEventListener('input', updateVolume);
$('#mute').addEventListener('click', () => {
  muted = !muted;
  $('#mute').setAttribute('aria-pressed', String(muted));
  $('#mute').setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  $('#sound-label').textContent = muted ? 'Sound off' : 'Sound on';
  updateVolume();
});
selectSong(selected);
