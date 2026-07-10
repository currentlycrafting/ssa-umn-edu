/* Dedicated SSA Daily word game. */
(function () {
  const WORDS = [
    'CAMPS', 'NORTH', 'MUSIC', 'EVENT', 'BOARD', 'PARKS', 'TRAIL', 'MIXER',
    'NIGHT', 'DANCE', 'UNITY', 'PRIDE', 'MNUSA', 'CAMEL', 'RIVER', 'GREEN',
    'SPORT', 'TEAMS', 'VIBES', 'PARTY', 'FIELD', 'STORY', 'PHOTO', 'VIDEO', 'DONOR'
  ];

  function dayWord() {
    return WORDS[Math.floor(Date.now() / 86400000) % WORDS.length];
  }

  const answer = dayWord();
  const dayKey = 'ssaDaily-' + Math.floor(Date.now() / 86400000);
  const board = document.getElementById('dailyBoard');
  const keys = document.getElementById('dailyKeys');
  const status = document.getElementById('dailyStatus');
  let row = 0;
  let col = 0;
  let done = false;
  const grid = Array.from({ length: 6 }, () => Array(5).fill(''));

  board.innerHTML = Array.from({ length: 6 }, (_, r) =>
    '<div class="daily-row">' + Array.from({ length: 5 }, (_, c) =>
      `<div class="daily-cell" id="dc-${r}-${c}"></div>`).join('') + '</div>'
  ).join('');

  const keyRows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  keys.innerHTML = keyRows.map((letters, index) =>
    '<div class="daily-key-row">' +
    (index === 2 ? '<button type="button" class="daily-key daily-key-wide" data-k="ENTER">Enter</button>' : '') +
    letters.split('').map((letter) => `<button type="button" class="daily-key" data-k="${letter}">${letter}</button>`).join('') +
    (index === 2 ? '<button type="button" class="daily-key daily-key-wide" data-k="BACK" aria-label="Backspace">Delete</button>' : '') +
    '</div>'
  ).join('');

  if (localStorage.getItem(dayKey)) {
    status.textContent = "You already finished today's SSA Daily. Come back tomorrow.";
    done = true;
  } else {
    status.textContent = 'Guess the five-letter word. Categories: SSA, culture, Minnesota, community.';
  }

  function handleKey(key) {
    if (done) return;
    if (key === 'BACK') {
      if (col > 0) {
        col -= 1;
        grid[row][col] = '';
        document.getElementById(`dc-${row}-${col}`).textContent = '';
      }
      return;
    }
    if (key === 'ENTER') {
      if (col < 5) {
        status.textContent = `${5 - col} more letter${5 - col === 1 ? '' : 's'} needed.`;
        return;
      }
      scoreRow(grid[row].join(''));
      return;
    }
    if (col < 5 && /^[A-Z]$/.test(key)) {
      grid[row][col] = key;
      document.getElementById(`dc-${row}-${col}`).textContent = key;
      col += 1;
      status.textContent = '';
    }
  }

  function scoreRow(guess) {
    const marks = Array(5).fill('absent');
    const remaining = {};
    for (let index = 0; index < 5; index += 1) {
      if (guess[index] === answer[index]) marks[index] = 'correct';
      else remaining[answer[index]] = (remaining[answer[index]] || 0) + 1;
    }
    for (let index = 0; index < 5; index += 1) {
      if (marks[index] !== 'correct' && remaining[guess[index]]) {
        marks[index] = 'present';
        remaining[guess[index]] -= 1;
      }
    }
    marks.forEach((mark, index) => {
      document.getElementById(`dc-${row}-${index}`).classList.add(mark);
      const key = keys.querySelector(`[data-k="${guess[index]}"]`);
      if (key) {
        const rank = { absent: 0, present: 1, correct: 2 };
        const current = ['absent', 'present', 'correct'].find((name) => key.classList.contains(name));
        if (!current || rank[mark] > rank[current]) {
          key.classList.remove('absent', 'present', 'correct');
          key.classList.add(mark);
        }
      }
    });
    if (guess === answer) {
      done = true;
      localStorage.setItem(dayKey, '1');
      showResult((6 - row) * 100, `Solved in ${row + 1} ${row === 0 ? 'try' : 'tries'}`);
      return;
    }
    row += 1;
    col = 0;
    if (row >= 6) {
      done = true;
      localStorage.setItem(dayKey, '1');
      showResult(null, `The word was ${answer}`);
    }
  }

  function showResult(score, headline) {
    document.getElementById('dailyResult').hidden = false;
    document.getElementById('dailyHeadline').textContent = headline;
    if (score == null) document.getElementById('dailyScoreForm').hidden = true;
    else window._dailyScore = score;
  }

  keys.querySelectorAll('[data-k]').forEach((button) => {
    button.addEventListener('click', () => handleKey(button.dataset.k));
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleKey('ENTER');
    else if (event.key === 'Backspace') handleKey('BACK');
    else if (/^[a-zA-Z]$/.test(event.key)) handleKey(event.key.toUpperCase());
  });

  document.getElementById('dailyScoreForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      await window.ssaFetch.json('/api/arcade', {
        method: 'POST',
        body: { game: 'daily', name: document.getElementById('dailyName').value.trim(), score: window._dailyScore }
      });
      document.getElementById('dailyHeadline').textContent = 'Score saved.';
      event.target.reset();
      loadLeaderboard();
    } catch (_) {
      document.getElementById('dailyHeadline').textContent = 'The game is complete, but the score could not be saved.';
    } finally {
      button.disabled = false;
    }
  });

  async function loadLeaderboard() {
    const body = document.getElementById('dailyLb');
    try {
      const data = await window.ssaFetch.json('/api/arcade/daily');
      body.innerHTML = data.scores.map((score, index) =>
        `<tr><td>#${index + 1}</td><td>${escapeHtml(score.name)}</td><td>${score.score}</td><td>${score.date}</td></tr>`
      ).join('') || '<tr><td colspan="4">No scores yet</td></tr>';
    } catch (_) {
      body.innerHTML = '<tr><td colspan="4">Leaderboard unavailable</td></tr>';
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  loadLeaderboard();
})();
