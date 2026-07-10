/* SSA Daily word game + games hub hash routing. */
(function () {
  const WORDS = [
    'CULTURE', 'CAMPS', 'NORTH', 'MUSIC', 'EVENT', 'BOARD', 'PARKS', 'TRAIL', 'MIXER',
    'NIGHT', 'DANCE', 'UNITY', 'PRIDE', 'MNUSA', 'CAMEL', 'RIVER', 'GREEN',
    'SPORT', 'TEAMS', 'VIBES', 'PARTY', 'FIELD', 'PILLS', 'STORY', 'PHOTO', 'VIDEO', 'DONOR'
  ].filter((word) => word.length === 5);

  function dayWord() {
    const day = Math.floor(Date.now() / 86400000);
    return WORDS[day % WORDS.length];
  }

  let initialized = false;
  function routeDaily() {
    const stage = document.getElementById('daily');
    if (!stage) return;
    const active = window.location.hash === '#daily';
    stage.hidden = !active;
    if (active) {
      stage.scrollIntoView({ behavior: initialized ? 'smooth' : 'auto' });
      if (!initialized) {
        initialized = true;
        initDaily();
      }
    }
  }
  routeDaily();
  window.addEventListener('hashchange', routeDaily);

  function initDaily() {
    const answer = dayWord();
    const dayKey = 'ssaDaily-' + Math.floor(Date.now() / 86400000);
    const board = document.getElementById('dailyBoard');
    const keys = document.getElementById('dailyKeys');
    const status = document.getElementById('dailyStatus');
    let row = 0, col = 0, done = false;
    const grid = Array.from({ length: 6 }, () => Array(5).fill(''));

    if (!board || !keys || !status) return;
    board.innerHTML = Array.from({ length: 6 }, (_, r) =>
      '<div class="daily-row">' + Array.from({ length: 5 }, (_, c) =>
        `<div class="daily-cell" id="dc-${r}-${c}"></div>`).join('') + '</div>'
    ).join('');

    const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
    keys.innerHTML = rows.map((r, i) =>
      '<div class="daily-key-row">' +
      (i === 2 ? '<button type="button" class="daily-key" data-k="ENTER" style="min-width:52px">Enter</button>' : '') +
      r.split('').map((k) => `<button type="button" class="daily-key" data-k="${k}">${k}</button>`).join('') +
      (i === 2 ? '<button type="button" class="daily-key" data-k="BACK" style="min-width:52px">⌫</button>' : '') +
      '</div>'
    ).join('');

    if (localStorage.getItem(dayKey)) {
      status.textContent = "You already finished today's SSA Daily — come back tomorrow.";
      done = true;
    } else {
      status.textContent = 'Guess the 5-letter word. Categories: SSA, culture, Minnesota, community.';
    }

    function key(k) {
      if (done) return;
      if (k === 'BACK') {
        if (col > 0) { col--; grid[row][col] = ''; const c = document.getElementById(`dc-${row}-${col}`); c.textContent = ''; }
        return;
      }
      if (k === 'ENTER') {
        if (col < 5) {
          status.textContent = `${5 - col} more letter${5 - col === 1 ? '' : 's'} needed.`;
          return;
        }
        const guess = grid[row].join('');
        status.textContent = '';
        scoreRow(guess);
        return;
      }
      if (col < 5 && /^[A-Z]$/.test(k)) {
        grid[row][col] = k;
        document.getElementById(`dc-${row}-${col}`).textContent = k;
        col++;
      }
    }

    function scoreRow(guess) {
      const marks = Array(5).fill('absent');
      const rem = {};
      for (let i = 0; i < 5; i++) {
        if (guess[i] === answer[i]) marks[i] = 'correct';
        else rem[answer[i]] = (rem[answer[i]] || 0) + 1;
      }
      for (let i = 0; i < 5; i++) {
        if (marks[i] === 'correct') continue;
        if (rem[guess[i]]) { marks[i] = 'present'; rem[guess[i]]--; }
      }
      marks.forEach((m, i) => {
        document.getElementById(`dc-${row}-${i}`).classList.add(m);
        const kb = keys.querySelector(`[data-k="${guess[i]}"]`);
        if (kb) {
          const rank = { absent: 0, present: 1, correct: 2 };
          const current = ['absent', 'present', 'correct'].find((name) => kb.classList.contains(name));
          if (!current || rank[m] > rank[current]) {
            kb.classList.remove('absent', 'present', 'correct');
            kb.classList.add(m);
          }
        }
      });
      if (guess === answer) {
        done = true;
        localStorage.setItem(dayKey, '1');
        showResult((7 - row - 1) * 100, `Solved in ${row + 1} ${row === 0 ? 'try' : 'tries'}`);
        return;
      }
      row++; col = 0;
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

    keys.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => key(b.dataset.k)));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') key('ENTER');
      else if (e.key === 'Backspace') key('BACK');
      else if (/^[a-zA-Z]$/.test(e.key)) key(e.key.toUpperCase());
    });

    document.getElementById('dailyScoreForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const out = document.getElementById('dailyHeadline');
      const button = e.submitter;
      if (button) button.disabled = true;
      try {
        await window.ssaFetch.json('/api/arcade', {
          method: 'POST',
          body: { game: 'daily', name: document.getElementById('dailyName').value.trim(), score: window._dailyScore }
        });
        out.textContent = 'Score saved.';
        e.target.reset();
        loadLb();
      } catch (_) {
        out.textContent = 'The game is complete, but the score could not be saved.';
      } finally {
        if (button) button.disabled = false;
      }
    });

    loadLb();
  }

  async function loadLb() {
    const tbody = document.getElementById('dailyLb');
    if (!tbody) return;
    try {
      const d = await window.ssaFetch.json('/api/arcade/daily');
      tbody.innerHTML = d.scores.map((s, i) =>
        `<tr><td>#${i + 1}</td><td>${s.name}</td><td>${s.score}</td><td>${s.date}</td></tr>`
      ).join('') || '<tr><td colspan="4">No scores yet</td></tr>';
    } catch (_) {
      tbody.innerHTML = '<tr><td colspan="4">Leaderboard unavailable</td></tr>';
    }
  }
})();
