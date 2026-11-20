(function () {
  const api = window.ssaFetch?.json;
  const form = document.getElementById('internForm');
  const output = document.getElementById('internOut');
  const modal = document.getElementById('internApplyModal');
  const nextBtn = document.getElementById('internNext');
  const prevBtn = document.getElementById('internPrev');
  const submitBtn = document.getElementById('internSubmit');
  const stepLabel = document.getElementById('internStepLabel');
  if (!api || !form || !modal) return;

  const APPLIED_KEY = 'ssaInternApplied';
  const TOTAL_STEPS = 4;
  let step = 1;
  const ALLOWED_AREAS = [
    'Executive',
    'Finance & Grants',
    'Social Media & Marketing',
    'Event Planning & Logistics',
    'Community Outreach'
  ];

  function setCounts(summary) {
    const total = Number(summary?.total) || 0;
    const byArea = summary?.byArea || {};
    document.querySelectorAll('[data-app-count]').forEach((el) => {
      const key = el.dataset.appCount;
      el.textContent = key === 'total' ? String(total) : String(Number(byArea[key]) || 0);
    });
  }

  async function loadCounts() {
    try {
      setCounts(await api('/api/applications/summary'));
    } catch (_) {}
  }

  function openModal() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    showStep(1);
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function showStep(next) {
    step = Math.max(1, Math.min(TOTAL_STEPS, next));
    form.querySelectorAll('.intern-step').forEach((section) => {
      const active = Number(section.dataset.step) === step;
      section.hidden = !active;
      section.classList.toggle('is-active', active);
    });
    document.querySelectorAll('.intern-step-dots span').forEach((dot) => {
      dot.classList.toggle('is-active', Number(dot.dataset.dot) <= step);
    });
    if (stepLabel) stepLabel.textContent = `${step} / ${TOTAL_STEPS}`;
    const onLast = step === TOTAL_STEPS;
    const onFirst = step === 1;
    if (prevBtn) {
      prevBtn.hidden = onFirst;
      prevBtn.classList.toggle('is-hidden', onFirst);
    }
    if (nextBtn) {
      nextBtn.hidden = onLast;
      nextBtn.classList.toggle('is-hidden', onLast);
    }
    if (submitBtn) {
      submitBtn.hidden = !onLast;
      submitBtn.classList.toggle('is-hidden', !onLast);
    }
    output.textContent = '';
  }

  function checkedValues(name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) =>
      String(input.value || '')
        .replace(/&amp;/g, '&')
        .replace(/\u00a0/g, ' ')
        .trim()
    );
  }

  function enforceExactCount(name, max) {
    form.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.addEventListener('change', () => {
        const selected = [...form.querySelectorAll(`input[name="${name}"]:checked`)];
        if (selected.length <= max) return;
        if (max === 1) {
          selected.forEach((box) => {
            if (box !== input) box.checked = false;
          });
          return;
        }
        input.checked = false;
        output.textContent = `Pick exactly ${max}.`;
      });
    });
  }

  function validateEmail(email) {
    const value = String(email || '').trim().toLowerCase();
    if (!value || !value.includes('@')) return { ok: false, message: 'Enter a valid email address.' };
    if (!value.endsWith('@umn.edu')) return { ok: false, message: 'Please use your UMN email (@umn.edu).' };
    return { ok: true, value };
  }

  function validateStep(current) {
    const data = new FormData(form);
    if (current === 1) {
      const emailCheck = validateEmail(data.get('email'));
      if (!emailCheck.ok) return emailCheck.message;
      if (!String(data.get('name') || '').trim()) return 'Name is required.';
      const years = checkedValues('year');
      if (years.length !== 1 || !['Freshman', 'Sophomore', 'Junior', 'Senior'].includes(years[0])) {
        return 'Pick exactly one year in school.';
      }
      return '';
    }
    if (current === 2) {
      const areas = checkedValues('preferredArea');
      if (areas.length !== 2 || areas.some((area) => !ALLOWED_AREAS.includes(area))) {
        return 'Pick exactly two rotational areas.';
      }
      if (!String(data.get('interestWhy') || '').trim()) return 'Tell us why you are interested in these positions.';
      return '';
    }
    if (current === 3) {
      if (!String(data.get('contribution') || '').trim()) return 'Tell us how you would contribute.';
      if (!String(data.get('goals') || '').trim()) return 'Share your goals for the internship.';
      return '';
    }
    if (current === 4) {
      const stay = checkedValues('stayOn');
      if (stay.length !== 1 || !['Yes', 'No'].includes(stay[0])) {
        return 'Pick Yes or No.';
      }
      return '';
    }
    return '';
  }

  function readForm() {
    const data = new FormData(form);
    const emailCheck = validateEmail(data.get('email'));
    const areas = checkedValues('preferredArea');
    return {
      email: emailCheck.value,
      name: String(data.get('name') || '').trim(),
      year: checkedValues('year')[0] || '',
      preferredAreas: areas,
      preferredArea: areas.join(' / '),
      interestWhy: String(data.get('interestWhy') || '').trim(),
      contribution: String(data.get('contribution') || '').trim(),
      goals: String(data.get('goals') || '').trim(),
      stayOn: checkedValues('stayOn')[0] || '',
      questions: String(data.get('questions') || '').trim()
    };
  }

  enforceExactCount('year', 1);
  enforceExactCount('preferredArea', 2);
  enforceExactCount('stayOn', 1);

  window.openInternApply = openModal;
  document.querySelectorAll('[data-open-intern-apply], #internOpenApply, #internFooterApply').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      openModal();
    });
  });
  document.getElementById('internApplyClose')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });

  nextBtn?.addEventListener('click', () => {
    const error = validateStep(step);
    if (error) {
      output.textContent = error;
      return;
    }
    showStep(step + 1);
  });
  prevBtn?.addEventListener('click', () => showStep(step - 1));

  if (localStorage.getItem(APPLIED_KEY) === '1') {
    submitBtn.disabled = true;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    for (let i = 1; i <= TOTAL_STEPS; i += 1) {
      const error = validateStep(i);
      if (error) {
        showStep(i);
        output.textContent = error;
        return;
      }
    }
    const payload = readForm();
    submitBtn.disabled = true;
    output.textContent = 'Submitting…';
    try {
      const result = await api('/api/applications', { method: 'POST', body: payload, timeout: 20000 });
      localStorage.setItem(APPLIED_KEY, '1');
      output.textContent = result.message || 'Application submitted. We will be in touch soon!';
      form.reset();
      await loadCounts();
      window.setTimeout(closeModal, 1200);
    } catch (error) {
      output.textContent = error.message || 'Could not submit right now. Try again.';
      submitBtn.disabled = false;
    }
  });

  loadCounts();
  setInterval(loadCounts, 60000);
  if (window.location.hash === '#apply') openModal();
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#apply') openModal();
  });
})();
