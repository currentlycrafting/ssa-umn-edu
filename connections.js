// Large Somali-themed pool. Each game randomly draws 4 groups, so there are
// thousands of possible puzzles.
const GROUP_POOL = [
  { name: 'Somali Foods', words: ['Sambusa', 'Bariis', 'Suqaar', 'Hilib'] },
  { name: 'Somali Breakfast', words: ['Canjeero', 'Malawax', 'Laxoox', 'Muqmad'] },
  { name: 'Somali Drinks', words: ['Shaah', 'Qaxwo', 'Vimto', 'Caano'] },
  { name: 'Somali Sweets', words: ['Halwo', 'Buskud', 'Doolsho', 'Jabaati'] },
  { name: 'Cultural Clothing', words: ['Dirac', 'Macawiis', 'Guntiino', 'Baati'] },
  { name: 'Wedding Things', words: ['Aroos', 'Xeedho', 'Henna', 'Shaash'] },
  { name: 'Immediate Family', words: ['Hooyo', 'Aabo', 'Walaal', 'Ilmo'] },
  { name: 'Extended Family', words: ['Ayeeyo', 'Awoowe', 'Adeer', 'Eedo'] },
  { name: 'Somali Dances', words: ['Dhaanto', 'Wiilsaaqo', 'Jandheer', 'Saylici'] },
  { name: 'More Somali Dances', words: ['Buraanbur', 'Hobeey', 'Batar', 'Shirib'] },
  { name: 'Somali Cities', words: ['Muqdisho', 'Hargeysa', 'Kismaayo', 'Boorama'] },
  { name: 'More Somali Cities', words: ['Baidoa', 'Garoowe', 'Berbera', 'Gaalkacyo'] },
  { name: 'Somali Regions', words: ['Banaadir', 'Awdal', 'Bari', 'Mudug'] },
  { name: 'Greetings', words: ['Nabad', 'Mahadsanid', 'Salaan', 'Soo dhawoow'] },
  { name: 'Animals', words: ['Geel', 'Ari', "Lo'", 'Faras'] },
  { name: 'Nature', words: ['Webi', 'Buur', 'Badweyn', 'Lamadegaan'] },
  { name: 'Colors', words: ['Cas', 'Buluug', 'Cagaar', 'Caddaan'] },
  { name: 'Numbers', words: ['Kow', 'Laba', 'Saddex', 'Afar'] },
  { name: 'Time', words: ['Maalin', 'Habeen', 'Toddobaad', 'Bil'] },
  { name: 'Poetry & Arts', words: ['Gabay', 'Heeso', 'Sheeko', 'Maahmaah'] },
  { name: 'SSA Presidents', words: ['Salman', 'Dahir', 'Mowlid', 'Anisa'] },
  { name: 'SSA Vice Presidents', words: ['Suhaila', 'Ruweyda', 'Aisha', 'Adnan'] },
  { name: 'Body Parts', words: ['Madax', 'Gacan', 'Lug', 'Indho'] },
  { name: 'Weather', words: ['Roob', 'Qorrax', 'Dabayl', 'Ceeryaamo'] },
  { name: 'On Campus', words: ['Jaamacad', 'Fasal', 'Macallin', 'Arday'] },
  { name: 'Sports', words: ['Kubad', 'Orod', 'Dabaal', 'Boodo'] },
  { name: 'In the House', words: ['Sariir', 'Miis', 'Kursi', 'Albaab'] },
  { name: 'At the Market', words: ['Suuq', 'Lacag', 'Dukaan', 'Iibso'] }
];

const MAX_MISTAKES = 4;

const gridEl = document.getElementById('grid');
const solvedEl = document.getElementById('solved');
const statusEl = document.getElementById('status');
const pipsEl = document.getElementById('pips');
const boardEl = document.getElementById('board');
const submitBtn = document.getElementById('submit');
const shuffleBtn = document.getElementById('shuffle');
const deselectBtn = document.getElementById('deselect');
const nameForm = document.getElementById('nameForm');
const nameInput = document.getElementById('nameInput');
const resultTitle = document.getElementById('resultTitle');
const resultMeta = document.getElementById('resultMeta');
const playAgainBtn = document.getElementById('playAgain');

let currentGroups = [];
let wordGroup = {};
let tiles = [];
let selected = new Set();
let solvedGroups = [];
let mistakes = 0;
let startTime = 0;
let timerStarted = false;
let gameOver = false;

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildPuzzle() {
  for (let attempt = 0; attempt < 60; attempt++) {
    const picks = shuffle(GROUP_POOL).slice(0, 4);
    const words = picks.flatMap((group) => group.words);
    if (new Set(words).size === 16) return picks;
  }
  return GROUP_POOL.slice(0, 4);
}

function newGame() {
  currentGroups = buildPuzzle();
  wordGroup = {};
  currentGroups.forEach((group, index) => {
    group.words.forEach((word) => { wordGroup[word] = index; });
  });
  tiles = shuffle(currentGroups.flatMap((group) => group.words));
  selected = new Set();
  solvedGroups = [];
  mistakes = 0;
  startTime = 0;
  timerStarted = false;
  gameOver = false;
  solvedEl.innerHTML = '';
  nameForm.style.display = 'none';
  statusEl.textContent = 'Select four words you think belong together.';
  renderPips();
  renderGrid();
}

function renderPips() {
  let html = '';
  for (let i = 0; i < MAX_MISTAKES; i++) {
    html += `<span class="pip ${i < mistakes ? 'used' : ''}"></span>`;
  }
  pipsEl.innerHTML = html;
}

function renderGrid() {
  gridEl.innerHTML = tiles.map((word) =>
    `<button class="tile ${selected.has(word) ? 'selected' : ''}" type="button" data-word="${word}">${word}</button>`
  ).join('');
  gridEl.querySelectorAll('.tile').forEach((tile) => {
    tile.addEventListener('click', () => onTileClick(tile.dataset.word));
  });
}

function onTileClick(word) {
  if (gameOver) return;
  if (!timerStarted) { startTime = Date.now(); timerStarted = true; }
  if (selected.has(word)) selected.delete(word);
  else if (selected.size < 4) selected.add(word);
  renderGrid();
}

function solveGroup(groupIndex) {
  solvedGroups.push(groupIndex);
  tiles = tiles.filter((word) => wordGroup[word] !== groupIndex);
  selected.clear();
  renderGrid();
  renderSolved();
  if (solvedGroups.length === currentGroups.length) endGame(true);
  else statusEl.textContent = 'Group found. Keep going.';
}

function renderSolved() {
  solvedEl.innerHTML = solvedGroups.map((index) => {
    const group = currentGroups[index];
    return `<div class="solved-row group-${index}"><strong>${group.name}</strong><span>${group.words.join(', ')}</span></div>`;
  }).join('');
}

function onSubmit() {
  if (gameOver || selected.size !== 4) return;
  const picked = Array.from(selected);
  const groupsOfPicked = picked.map((word) => wordGroup[word]);
  const allSame = groupsOfPicked.every((g) => g === groupsOfPicked[0]);

  if (allSame) {
    solveGroup(groupsOfPicked[0]);
    return;
  }

  const counts = {};
  groupsOfPicked.forEach((g) => { counts[g] = (counts[g] || 0) + 1; });
  const closest = Math.max(...Object.values(counts));
  mistakes += 1;
  renderPips();
  gridEl.querySelectorAll('.tile.selected').forEach((tile) => {
    tile.classList.add('shake');
    window.setTimeout(() => tile.classList.remove('shake'), 450);
  });
  statusEl.textContent = closest === 3 ? 'One away…' : 'Not a group. Try again.';
  if (mistakes >= MAX_MISTAKES) endGame(false);
}

function elapsedSeconds() {
  return timerStarted ? Math.round((Date.now() - startTime) / 1000) : 0;
}

function endGame(won) {
  gameOver = true;
  const seconds = elapsedSeconds();
  if (!won) {
    currentGroups.forEach((_, index) => { if (!solvedGroups.includes(index)) solvedGroups.push(index); });
    tiles = [];
    renderGrid();
    renderSolved();
  }
  statusEl.textContent = won ? 'Solved it!' : 'Out of tries — here were the groups.';
  showResult(won, seconds);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showResult(won, seconds) {
  nameForm.style.display = 'block';
  if (won) {
    resultTitle.textContent = 'Nice solve.';
    resultMeta.textContent = `Time ${formatTime(seconds)} · ${mistakes} mistake${mistakes === 1 ? '' : 's'}. Add your name to the leaderboard.`;
    nameInput.style.display = '';
    nameForm.querySelector('button[type="submit"]').style.display = '';
    nameForm.dataset.seconds = String(seconds);
    nameForm.dataset.won = '1';
    window.setTimeout(() => nameInput.focus(), 80);
  } else {
    resultTitle.textContent = 'Out of tries.';
    resultMeta.textContent = 'Only solved games make the leaderboard. Give it another go.';
    nameInput.style.display = 'none';
    nameForm.querySelector('button[type="submit"]').style.display = 'none';
    nameForm.dataset.won = '0';
  }
}

function localBoard() {
  return JSON.parse(localStorage.getItem('ssaGameBoard') || '[]')
    .filter((entry) => entry.solved)
    .sort((a, b) => a.mistakes - b.mistakes || a.seconds - b.seconds)
    .slice(0, 10);
}

function renderLeaderboard(scores) {
  if (!scores || !scores.length) {
    boardEl.innerHTML = '<li class="empty">No solves yet. Be the first.</li>';
    return;
  }
  boardEl.innerHTML = scores.map((entry, index) =>
    `<li><span class="rank">${index + 1}</span><span class="who">${escapeHtml(entry.name)}</span><span class="score">${formatTime(entry.seconds)} · ${entry.mistakes} mistake${entry.mistakes === 1 ? '' : 's'}</span></li>`
  ).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) throw new Error('no server');
    const data = await res.json();
    renderLeaderboard(data.scores || []);
  } catch (error) {
    renderLeaderboard(localBoard());
  }
}

async function saveScore(name, seconds) {
  const entry = { name, mistakes, seconds, solved: true };
  try {
    const res = await fetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    if (!res.ok) throw new Error('no server');
    const data = await res.json();
    renderLeaderboard(data.scores || []);
  } catch (error) {
    const stored = JSON.parse(localStorage.getItem('ssaGameBoard') || '[]');
    stored.push(entry);
    localStorage.setItem('ssaGameBoard', JSON.stringify(stored));
    renderLeaderboard(localBoard());
  }
}

submitBtn.addEventListener('click', onSubmit);
shuffleBtn.addEventListener('click', () => { if (!gameOver) { tiles = shuffle(tiles); renderGrid(); } });
deselectBtn.addEventListener('click', () => { selected.clear(); renderGrid(); });
playAgainBtn.addEventListener('click', () => { newGame(); loadLeaderboard(); });
nameForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (nameForm.dataset.won !== '1') return;
  const name = (nameInput.value || 'Anonymous').trim() || 'Anonymous';
  const seconds = parseInt(nameForm.dataset.seconds, 10) || 0;
  saveScore(name, seconds);
  if (localStorage.getItem('ssaGameSubmitted') !== '1') {
    localStorage.setItem('ssaGameSubmitted', '1');
    window.markChecklistStep?.('game', 'Score saved — game step complete.');
  }
  resultMeta.textContent = 'Saved. Thanks for playing — come back to beat your time.';
  nameInput.style.display = 'none';
  nameForm.querySelector('button[type="submit"]').style.display = 'none';
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !gameOver && document.activeElement === document.body) onSubmit();
});

newGame();
loadLeaderboard();
