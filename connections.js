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

const POWERUPS = {
  category: { label: 'Category', icon: '🏷', title: 'Reveal a group name' },
  link: { label: 'Word link', icon: '🔗', title: 'Highlight two matching words' },
  shield: { label: 'Shield', icon: '🛡', title: 'Block your next mistake' }
};

const gridEl = document.getElementById('grid');
const solvedEl = document.getElementById('solved');
const statusEl = document.getElementById('status');
const pipsEl = document.getElementById('pips');
const boardEl = document.getElementById('board');
const powerupBarEl = document.getElementById('powerupBar');
const submitBtn = document.getElementById('submit');
const shuffleBtn = document.getElementById('shuffle');
const deselectBtn = document.getElementById('deselect');
const nameForm = document.getElementById('nameForm');
const nameInput = document.getElementById('nameInput');
const resultTitle = document.getElementById('resultTitle');
const resultMeta = document.getElementById('resultMeta');
const playAgainBtn = document.getElementById('playAgain');
const retryLeaderboardBtn = document.getElementById('retryLeaderboard');

let currentGroups = [];
let wordGroup = {};
let tiles = [];
let selected = new Set();
let linkedWords = new Set();
let solvedGroups = [];
let mistakes = 0;
let startTime = 0;
let timerStarted = false;
let gameOver = false;
let powerUps = { category: 0, link: 0, shield: 0 };
let shieldArmed = false;

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
  linkedWords = new Set();
  solvedGroups = [];
  mistakes = 0;
  startTime = 0;
  timerStarted = false;
  gameOver = false;
  powerUps = { category: 0, link: 0, shield: 0 };
  shieldArmed = false;
  solvedEl.innerHTML = '';
  nameForm.style.display = 'none';
  document.querySelector('.game-wrap')?.classList.remove('game-won');
  statusEl.textContent = 'Select four words you think belong together.';
  renderPips();
  renderHud();
  renderGrid();
}

function unsolvedGroupIndexes() {
  return currentGroups.map((_, index) => index).filter((index) => !solvedGroups.includes(index));
}

function addPowerUp(type, amount = 1) {
  if (!POWERUPS[type]) return;
  powerUps[type] += amount;
  renderHud();
}

function solveRewardMessage(count) {
  if (count === 1) return 'Group found! Category peek unlocked.';
  if (count === 2) return 'Group found! Word link unlocked.';
  if (count === 3) return 'Group found! Shield unlocked.';
  if (count === 4) return 'Group found! Bonus power-up earned.';
  return 'Group found. Keep going.';
}

function grantSolveRewards() {
  const count = solvedGroups.length;
  if (count === 1) addPowerUp('category');
  else if (count === 2) addPowerUp('link');
  else if (count === 3) addPowerUp('shield');
  else if (count === 4) {
    const types = Object.keys(POWERUPS);
    addPowerUp(types[Math.floor(Math.random() * types.length)]);
  }
  statusEl.textContent = solveRewardMessage(count);
}

function renderHud() {
  if (!powerupBarEl) return;
  const entries = Object.keys(POWERUPS);
  const visible = entries.filter((key) => powerUps[key] > 0 || (key === 'shield' && shieldArmed));
  if (!visible.length) {
    powerupBarEl.innerHTML = '<span class="powerup-empty">Solve a group to earn power-ups</span>';
    return;
  }
  powerupBarEl.innerHTML = visible.map((key) => {
    const meta = POWERUPS[key];
    const count = powerUps[key];
    const armed = key === 'shield' && shieldArmed;
    const disabled = gameOver || (count <= 0 && !armed);
    return `<button class="powerup-btn ${armed ? 'is-armed' : ''}" type="button" data-powerup="${key}" title="${meta.title}" ${disabled ? 'disabled' : ''}>
      <span aria-hidden="true">${meta.icon}</span>
      <span>${meta.label}</span>
      <span class="powerup-count">${armed ? 'ON' : count}</span>
    </button>`;
  }).join('');
  powerupBarEl.querySelectorAll('.powerup-btn').forEach((btn) => {
    btn.addEventListener('click', () => usePowerUp(btn.dataset.powerup));
  });
}

function usePowerUp(type) {
  if (gameOver) return;
  if (type === 'shield') {
    if (shieldArmed) {
      shieldArmed = false;
      powerUps.shield += 1;
      statusEl.textContent = 'Shield disarmed.';
      renderHud();
      return;
    }
    if (powerUps.shield <= 0) return;
    powerUps.shield -= 1;
    shieldArmed = true;
    statusEl.textContent = 'Shield armed — your next mistake is blocked.';
    renderHud();
    return;
  }
  if (powerUps[type] <= 0) return;
  const remaining = unsolvedGroupIndexes();
  if (!remaining.length) return;

  if (type === 'category') {
    const groupIndex = remaining[Math.floor(Math.random() * remaining.length)];
    powerUps.category -= 1;
    statusEl.textContent = `Category peek: one group is “${currentGroups[groupIndex].name}”.`;
    renderHud();
    return;
  }

  if (type === 'link') {
    const groupIndex = remaining[Math.floor(Math.random() * remaining.length)];
    const words = currentGroups[groupIndex].words.filter((word) => tiles.includes(word));
    if (words.length < 2) return;
    const shuffled = shuffle(words);
    linkedWords = new Set(shuffled.slice(0, 2));
    powerUps.link -= 1;
    statusEl.textContent = 'Word link: two tiles belong together.';
    renderGrid();
    renderHud();
  }
}

function renderPips() {
  let html = '';
  for (let i = 0; i < MAX_MISTAKES; i++) {
    html += `<span class="pip ${i < mistakes ? 'used' : ''}"></span>`;
  }
  pipsEl.innerHTML = html;
}

function renderGrid() {
  gridEl.innerHTML = tiles.map((word) => {
    const classes = ['tile'];
    if (selected.has(word)) classes.push('selected');
    if (linkedWords.has(word)) classes.push('tile-linked');
    return `<button class="${classes.join(' ')}" type="button" data-word="${word}">${word}</button>`;
  }).join('');
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
  linkedWords = new Set();
  gridEl.querySelectorAll('.tile.selected').forEach((tile) => {
    tile.classList.add('correct-flash');
  });
  tiles = tiles.filter((word) => wordGroup[word] !== groupIndex);
  selected.clear();
  renderGrid();
  renderSolved();
  grantSolveRewards();
  if (statusEl) {
    statusEl.classList.remove('status-bump');
    void statusEl.offsetWidth;
    statusEl.classList.add('status-bump');
  }
  renderHud();
  if (solvedGroups.length === currentGroups.length) endGame(true);
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

  if (shieldArmed) {
    shieldArmed = false;
    linkedWords = new Set();
    renderGrid();
    gridEl.querySelectorAll('.tile.selected').forEach((tile) => {
      tile.classList.add('shake');
      window.setTimeout(() => tile.classList.remove('shake'), 450);
    });
    statusEl.textContent = closest === 3 ? 'One away — shield blocked the mistake!' : 'Shield blocked that mistake!';
    renderHud();
    return;
  }

  linkedWords = new Set();
  mistakes += 1;
  renderPips();
  renderHud();
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
  renderHud();
  if (won) {
    document.querySelector('.game-wrap')?.classList.add('game-won');
    window.ssaPulse?.(statusEl, 'status-win');
  }
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

function showLeaderboardLoading(message) {
  if (retryLeaderboardBtn) retryLeaderboardBtn.hidden = true;
  boardEl.innerHTML = `<li class="empty leaderboard-loading">${message || 'Loading scores…'}</li>`;
}

function showLeaderboardError(message) {
  boardEl.innerHTML = `<li class="empty">${message || 'Scores unavailable right now.'}</li>`;
  if (retryLeaderboardBtn) retryLeaderboardBtn.hidden = false;
}

function renderLeaderboard(scores) {
  if (retryLeaderboardBtn) retryLeaderboardBtn.hidden = true;
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
  showLeaderboardLoading('Loading scores…');
  try {
    const data = await window.ssaFetch.json('/api/leaderboard', { timeout: 20000, retries: 3 });
    renderLeaderboard(data.scores || []);
  } catch (error) {
    showLeaderboardError('Scores still waking up — keep playing. Tap retry when ready.');
  }
}

async function saveScore(name, seconds) {
  const entry = { name, mistakes, seconds, solved: true };
  const data = await window.ssaFetch.json('/api/score', {
    method: 'POST',
    body: entry,
    timeout: 20000,
    retries: 2
  });
  renderLeaderboard(data.scores || []);
}

submitBtn.addEventListener('click', onSubmit);
shuffleBtn.addEventListener('click', () => {
  if (!gameOver) {
    gridEl.classList.add('shuffling');
    tiles = shuffle(tiles);
    linkedWords = new Set();
    renderGrid();
    window.setTimeout(() => gridEl.classList.remove('shuffling'), 400);
  }
});
deselectBtn.addEventListener('click', () => { selected.clear(); renderGrid(); });
playAgainBtn.addEventListener('click', () => { newGame(); loadLeaderboard(); });
retryLeaderboardBtn && retryLeaderboardBtn.addEventListener('click', () => loadLeaderboard());
nameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (nameForm.dataset.won !== '1') return;
  const name = (nameInput.value || 'Anonymous').trim() || 'Anonymous';
  const seconds = parseInt(nameForm.dataset.seconds, 10) || 0;
  const saveBtn = nameForm.querySelector('button[type="submit"]');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.classList.add('is-loading');
  }
  try {
    await saveScore(name, seconds);
  } catch (error) {
    resultMeta.textContent = 'Could not save score yet — server may still be waking up. Try again in a moment.';
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.classList.remove('is-loading');
    }
    return;
  }
  if (saveBtn) saveBtn.classList.remove('is-loading');
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
