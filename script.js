(() => {
  const tg = window.Telegram && Telegram.WebApp;
  const $ = (s) => document.querySelector(s);
  const started = Date.now();
  const INK = '#2236b8';
  const W = 300, H = 120; // логические размеры холста подписи

  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch (e) {}
    try { tg.setHeaderColor('#142329'); tg.setBackgroundColor('#142329'); } catch (e) {}
  }

  const today = new Date().toLocaleDateString('ru-RU');
  $('#today').textContent = today;
  $('#stampDate').textContent = today;

  const nameInput = $('#name');
  const u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  if (u) nameInput.value = [u.first_name, u.last_name].filter(Boolean).join(' ');

  /* --- прогресс прокрутки и «дочитал до конца» --- */
  const bar = $('#bar');
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  let readToEnd = false;
  new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) readToEnd = true;
  }).observe($('#end'));

  /* --- подпись --- */
  const pad = $('#pad');
  const ctx = pad.getContext('2d');
  ctx.scale(2, 2);
  ctx.lineWidth = 2.2;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;

  let strokes = [];
  let cur = null;

  const pos = (e) => {
    const r = pad.getBoundingClientRect();
    return [
      Math.max(0, Math.min(W, Math.round(((e.clientX - r.left) * W) / r.width))),
      Math.max(0, Math.min(H, Math.round(((e.clientY - r.top) * H) / r.height))),
    ];
  };
  const seg = (a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };

  pad.addEventListener('pointerdown', (e) => {
    pad.setPointerCapture(e.pointerId);
    const p = pos(e);
    cur = [p];
    strokes.push(cur);
    seg(p, [p[0] + 0.1, p[1]]);
  });
  pad.addEventListener('pointermove', (e) => {
    if (!cur) return;
    const p = pos(e);
    const l = cur[cur.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 2) return;
    cur.push(p);
    seg(l, p);
  });
  const endStroke = () => { cur = null; validate(); };
  pad.addEventListener('pointerup', endStroke);
  pad.addEventListener('pointercancel', endStroke);

  $('#clear').addEventListener('click', () => {
    ctx.clearRect(0, 0, W, H);
    strokes = [];
    validate();
  });

  /* --- проверка формы --- */
  const checks = [...document.querySelectorAll('.chk input')];
  const go = $('#go');
  const need = $('#need');
  const ru = (n, a, b, c) => {
    const m10 = n % 10, m100 = n % 100;
    return n + ' ' + (m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c);
  };

  function validate() {
    const miss = [];
    const left = checks.filter((c) => !c.checked).length;
    if (left) miss.push(ru(left, 'отметка', 'отметки', 'отметок'));
    if (nameInput.value.trim().length < 2) miss.push('имя');
    if (strokes.reduce((n, s) => n + s.length, 0) < 6) miss.push('подпись');
    go.disabled = miss.length > 0;
    need.textContent = miss.length ? 'Осталось: ' + miss.join(', ') : '';
  }
  checks.forEach((c) => c.addEventListener('change', validate));
  nameInput.addEventListener('input', validate);
  validate();

  /* --- отправка боту (лимит sendData — 4096 байт) --- */
  function pack() {
    const enc = new TextEncoder();
    let step = 1, data;
    do {
      const s = strokes.map((st) => {
        const out = [];
        st.forEach((p, i) => { if (i % step === 0 || i === st.length - 1) out.push(p[0], p[1]); });
        return out;
      });
      data = JSON.stringify({
        n: nameInput.value.trim().slice(0, 60),
        r: readToEnd ? 1 : 0,
        t: Math.round((Date.now() - started) / 1000),
        s,
      });
      step++;
    } while (enc.encode(data).length > 3900 && step < 50);
    return data;
  }

  let sent = false;
  go.addEventListener('click', () => {
    if (go.disabled || sent) return;
    sent = true;
    const data = pack();
    document.body.classList.add('stamped');
    try { tg && tg.HapticFeedback && tg.HapticFeedback.notificationOccurred('success'); } catch (e) {}
    setTimeout(() => {
      if (tg && tg.initData) tg.sendData(data); // окно закроется само
      else alert('Тест в браузере. Боту ушло бы:\n' + data);
    }, 1700);
  });
})();
