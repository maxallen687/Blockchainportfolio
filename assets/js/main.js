/*!
 * Portfolio interactions. No dependencies, no trackers.
 * Each feature is initialised independently so one failure never breaks the page.
 */
(() => {
  'use strict';
  window.__portfolioReady = true;

  /* ------------------------------------------------------------------------
   * Config
   * --------------------------------------------------------------------- */
  const CONFIG = {
    // Keyless public Ethereum RPC endpoints with CORS enabled, tried in order.
    rpcUrls: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
    ],
    pollMs: 12000,
    // Only used when every RPC is unreachable: the block number is estimated from this anchor
    // and the widget is clearly labelled "Simulated".
    anchor: { block: 26125865, time: 1791199643 },
    slotSeconds: 12,
  };

  /* ------------------------------------------------------------------------
   * Utilities
   * --------------------------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Run `fn` once the page (fonts, images) has finished loading, keeping startup work off the critical path. */
  function onLoad(fn) {
    if (document.readyState === 'complete') setTimeout(fn, 0);
    else window.addEventListener('load', () => setTimeout(fn, 0), { once: true });
  }

  /** Run `fn` at most once per animation frame on scroll and resize. */
  function onScrollFrame(fn) {
    let queued = false;
    const handler = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; fn(); });
    };
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    handler();
    return handler;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.append(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  let toastTimer = 0;
  function toast(message, ok = true) {
    const el = $('#toast');
    if (!el) return;
    el.innerHTML = `${ok ? '<svg class="icon" aria-hidden="true"><use href="#i-check"/></svg>' : ''}<span>${escapeHTML(message)}</span>`;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
  }

  /* ------------------------------------------------------------------------
   * Small helpers for platform details
   * --------------------------------------------------------------------- */
  function initModKey() {
    const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent;
    if (!/Mac|iPhone|iPad|iPod/i.test(platform)) {
      $$('[data-mod-key]').forEach((el) => { el.textContent = 'Ctrl\u00a0'; });
    }
  }

  function initYear() {
    $$('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  }

  /* ------------------------------------------------------------------------
   * Navigation
   * --------------------------------------------------------------------- */
  function initNav() {
    const nav = $('#nav');
    if (nav) onScrollFrame(() => nav.classList.toggle('is-scrolled', window.scrollY > 8));
  }

  function initMobileMenu() {
    const toggle = $('.nav__toggle');
    const menu = $('#mobile-menu');
    if (!toggle || !menu) return;
    const behind = [$('#main'), $('.footer')].filter(Boolean);
    let open = false;

    const set = (next) => {
      open = next;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('menu-open', open);
      behind.forEach((el) => { el.inert = open; });
      if (open) {
        menu.hidden = false;
        void menu.offsetWidth; // commit display before the fade-in transition
        menu.classList.add('is-open');
      } else {
        menu.classList.remove('is-open');
        setTimeout(() => { if (!open) menu.hidden = true; }, 350);
      }
    };

    toggle.addEventListener('click', () => set(!open));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) { set(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 961px)').addEventListener('change', (e) => { if (e.matches && open) set(false); });
  }

  function initScrollSpy() {
    const links = $$('.nav__links a[href^="#"]');
    if (!links.length || !hasIO) return;
    const ids = new Set(links.map((a) => a.hash.slice(1)));
    const setActive = (id) => links.forEach((a) => {
      const on = a.hash.slice(1) === id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    let current = null;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) current = entry.target.id;
        else if (entry.target.id === current) current = null;
      });
      setActive(current && ids.has(current) ? current : null);
    }, { rootMargin: '-45% 0px -54% 0px' });
    $$('main > section[id]').forEach((section) => io.observe(section));
  }

  /* ------------------------------------------------------------------------
   * Reveal on scroll, scrambled eyebrows, counters
   * --------------------------------------------------------------------- */
  function initReveal() {
    $$('[data-stagger]').forEach((group) => {
      const step = parseInt(group.dataset.stagger, 10) || 80;
      $$(':scope > [data-reveal]', group).forEach((el, i) => el.style.setProperty('--d', `${i * step}ms`));
    });
    const els = $$('[data-reveal]');
    if (reduceMotion || !hasIO) {
      els.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach((el) => io.observe(el));
  }

  function initScramble() {
    const els = $$('[data-scramble]');
    if (!els.length || reduceMotion || !hasIO) return;
    const glyphs = '0123456789abcdef';
    const run = (el) => {
      const final = el.textContent;
      const start = performance.now();
      const duration = 600 + final.length * 20;
      const frame = (now) => {
        const p = clamp((now - start) / duration, 0, 1);
        const settled = Math.floor(p * final.length);
        let out = '';
        for (let i = 0; i < final.length; i++) {
          const ch = final[i];
          out += i < settled || ch === ' ' || ch === '/' ? ch : glyphs[(Math.random() * 16) | 0];
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(frame); else el.textContent = final;
      };
      requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        run(entry.target);
      });
    }, { threshold: 1 });
    els.forEach((el) => io.observe(el));
  }

  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length || reduceMotion || !hasIO) return; // the HTML already shows final values
    const format = (el, value) => {
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const number = value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      return `${el.dataset.prefix || ''}${number}${el.dataset.suffix || ''}`;
    };
    const animate = (el) => {
      const target = parseFloat(el.dataset.count);
      const start = performance.now();
      const duration = 1800;
      const frame = (now) => {
        const p = clamp((now - start) / duration, 0, 1);
        const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        el.textContent = format(el, target * eased);
        if (p < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    };
    els.forEach((el) => { el.textContent = format(el, 0); });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        animate(entry.target);
      });
    }, { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------------
   * Pointer effects: card spotlight, magnetic buttons, hero tilt
   * --------------------------------------------------------------------- */
  function initSpotlight() {
    if (!finePointer) return;
    let active = null;
    const reset = () => {
      if (!active) return;
      active.style.removeProperty('--mx');
      active.style.removeProperty('--my');
      active = null;
    };
    document.addEventListener('pointermove', (e) => {
      const card = e.target instanceof Element ? e.target.closest('.spot') : null;
      if (active && active !== card) reset();
      if (!card) return;
      active = card;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', reset);
  }

  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.22;
        const y = (e.clientY - r.top - r.height / 2) * 0.35;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  function initTilt() {
    const stage = $('[data-tilt]');
    const hero = $('.hero');
    if (!stage || !hero || !finePointer || reduceMotion) return;
    let raf = 0;
    hero.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = hero.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        stage.style.setProperty('--ry', `${(px * 9).toFixed(2)}deg`);
        stage.style.setProperty('--rx', `${(-py * 7).toFixed(2)}deg`);
      });
    });
    hero.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      stage.style.setProperty('--ry', '0deg');
      stage.style.setProperty('--rx', '0deg');
    });
  }

  /* ------------------------------------------------------------------------
   * Hero: animated peer-to-peer network
   * --------------------------------------------------------------------- */
  function initNetwork() {
    const canvas = $('#network');
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    if (!ctx) return;
    const hero = canvas.closest('.hero') || document.body;
    const pointer = { x: -1e4, y: -1e4 };
    const BUCKETS = 6;
    // Capable devices get continuous ambient motion. Phones and low-core devices draw the network once
    // and only animate it for a moment when a new Ethereum block arrives (about every 12 s).
    const lowPower = window.matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
    let ready = false;
    let burstUntil = 0;
    let w = 0;
    let h = 0;
    let nodes = [];
    let pulses = [];
    let rings = [];
    let running = false;
    let visible = true;
    let raf = 0;
    let last = 0;
    let spawnIn = 0;

    const linkDist = () => clamp(w / 8.5, 110, 175);

    function build() {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(clamp((w * h) / 15000, 26, 96));
      nodes = Array.from({ length: count }, () => {
        const hub = Math.random() < 0.14;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.24,
          vy: (Math.random() - 0.5) * 0.24,
          r: hub ? 2.3 : 1 + Math.random() * 0.7,
          hub,
        };
      });
      pulses = [];
      rings = [];
      draw();
    }

    const neighbours = (i, max) => {
      const a = nodes[i];
      const out = [];
      for (let j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        const dx = a.x - nodes[j].x;
        const dy = a.y - nodes[j].y;
        if (dx * dx + dy * dy < max * max) out.push(j);
      }
      return out;
    };
    const randomHub = () => {
      const hubs = [];
      nodes.forEach((n, i) => { if (n.hub) hubs.push(i); });
      return hubs.length ? hubs[(Math.random() * hubs.length) | 0] : (Math.random() * nodes.length) | 0;
    };
    const spawnPulse = (from, hops, exclude = -1) => {
      const options = neighbours(from, linkDist()).filter((j) => j !== exclude);
      if (!options.length) return;
      pulses.push({ from, to: options[(Math.random() * options.length) | 0], t: 0, speed: 0.0011 + Math.random() * 0.0008, hops });
    };
    // A new block: a ring expands from a validator and the block gossips to its peers.
    const burst = () => {
      if (!nodes.length) return;
      const i = randomHub();
      rings.push({ i, t: 0 });
      neighbours(i, linkDist()).slice(0, 6).forEach((j) => pulses.push({ from: i, to: j, t: 0, speed: 0.0016, hops: 1 }));
    };

    function step(dt) {
      const k = dt / 16.67;
      for (const n of nodes) {
        n.x += n.vx * k;
        n.y += n.vy * k;
        if (n.x < -30) n.x = w + 30; else if (n.x > w + 30) n.x = -30;
        if (n.y < -30) n.y = h + 30; else if (n.y > h + 30) n.y = -30;
      }
      for (let p = pulses.length - 1; p >= 0; p--) {
        const pulse = pulses[p];
        pulse.t += pulse.speed * dt;
        if (pulse.t >= 1) {
          pulses.splice(p, 1);
          if (pulse.hops > 0 && pulses.length < 40) spawnPulse(pulse.to, pulse.hops - 1, pulse.from);
        }
      }
      for (let r = rings.length - 1; r >= 0; r--) {
        rings[r].t += dt / 1600;
        if (rings[r].t >= 1) rings.splice(r, 1);
      }
      spawnIn -= dt;
      if (!lowPower && spawnIn <= 0 && nodes.length) {
        spawnIn = 380 + Math.random() * 520;
        spawnPulse(Math.random() < 0.6 ? randomHub() : (Math.random() * nodes.length) | 0, 2);
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const L = linkDist();
      const L2 = L * L;
      const buckets = Array.from({ length: BUCKETS }, () => []);
      const pointerLinks = [];
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > L2) continue;
          const strength = 1 - Math.sqrt(d2) / L;
          buckets[Math.min(BUCKETS - 1, (strength * BUCKETS) | 0)].push(a.x, a.y, b.x, b.y);
        }
        const pdx = a.x - pointer.x;
        const pdy = a.y - pointer.y;
        const pd = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pd < L * 1.1) pointerLinks.push(a, 1 - pd / (L * 1.1));
      }
      // Edges, batched by opacity so each frame costs a handful of draw calls.
      ctx.lineWidth = 1;
      buckets.forEach((segs, b) => {
        if (!segs.length) return;
        ctx.strokeStyle = `rgba(150, 185, 255, ${(((b + 0.5) / BUCKETS) * 0.2).toFixed(3)})`;
        ctx.beginPath();
        for (let s = 0; s < segs.length; s += 4) {
          ctx.moveTo(segs[s], segs[s + 1]);
          ctx.lineTo(segs[s + 2], segs[s + 3]);
        }
        ctx.stroke();
      });
      for (let p = 0; p < pointerLinks.length; p += 2) {
        const n = pointerLinks[p];
        ctx.strokeStyle = `rgba(124, 248, 214, ${(pointerLinks[p + 1] * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(n.x, n.y);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
      }
      // Nodes
      ctx.fillStyle = 'rgba(200, 214, 255, 0.55)';
      ctx.beginPath();
      for (const n of nodes) {
        if (n.hub) continue;
        ctx.moveTo(n.x + n.r, n.y);
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      }
      ctx.fill();
      for (const n of nodes) {
        if (!n.hub) continue;
        ctx.fillStyle = 'rgba(124, 248, 214, 0.12)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(124, 248, 214, 0.95)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Block rings
      for (const ring of rings) {
        const n = nodes[ring.i];
        if (!n) continue;
        const eased = 1 - Math.pow(1 - ring.t, 3);
        ctx.strokeStyle = `rgba(124, 248, 214, ${(0.55 * (1 - ring.t)).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 6 + eased * 120, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Transactions travelling between peers
      ctx.lineWidth = 1.5;
      for (const p of pulses) {
        const a = nodes[p.from];
        const b = nodes[p.to];
        if (!a || !b) continue;
        const x = a.x + (b.x - a.x) * p.t;
        const y = a.y + (b.y - a.y) * p.t;
        const tail = Math.max(0, p.t - 0.18);
        const tx = a.x + (b.x - a.x) * tail;
        const ty = a.y + (b.y - a.y) * tail;
        const grad = ctx.createLinearGradient(tx, ty, x, y);
        grad.addColorStop(0, 'rgba(124, 248, 214, 0)');
        grad.addColorStop(1, 'rgba(124, 248, 214, 0.85)');
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(225, 255, 247, 0.95)';
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function frame(now) {
      if (!running) return;
      if (lowPower && now > burstUntil) {
        pulses = [];
        rings = [];
        draw();
        stop();
        return;
      }
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(64, now - last) : 16.67;
      last = now;
      step(dt);
      draw();
    }
    const start = () => {
      if (!ready || running || reduceMotion || !visible || document.hidden) return;
      if (lowPower && performance.now() > burstUntil) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    build();
    if ('ResizeObserver' in window) {
      let timer = 0;
      let first = true;
      new ResizeObserver(() => {
        if (first) { first = false; return; }
        clearTimeout(timer);
        timer = setTimeout(build, 160);
      }).observe(canvas);
    }
    if (hasIO) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start(); else stop();
      }).observe(hero);
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        pointer.x = e.clientX - r.left;
        pointer.y = e.clientY - r.top;
      }, { passive: true });
      hero.addEventListener('pointerleave', () => { pointer.x = -1e4; pointer.y = -1e4; });
    }
    document.addEventListener('chain:block', () => {
      if (!ready || reduceMotion || !visible || document.hidden) return;
      if (lowPower) burstUntil = performance.now() + 2800;
      burst();
      start();
    });
    onLoad(() => setTimeout(() => { ready = true; start(); }, 250));
  }

  /* ------------------------------------------------------------------------
   * Hero terminal: replays the real `forge` output written in the HTML
   * --------------------------------------------------------------------- */
  function initTerminal() {
    const out = $('#terminal-output');
    if (!out) return;
    const script = $$('.t-line', out).map((el) => {
      const cmdEl = el.querySelector('.t-cmd');
      const isCmd = el.hasAttribute('data-cmd') && !!cmdEl;
      let promptHTML = '';
      if (isCmd) {
        const clone = el.cloneNode(true);
        clone.querySelector('.t-cmd').remove();
        promptHTML = clone.innerHTML;
      }
      return {
        className: el.className,
        html: el.innerHTML,
        command: isCmd ? cmdEl.textContent : null,
        promptHTML,
        delay: parseInt(el.dataset.delay || '120', 10),
      };
    });
    const firstCmd = script.find((s) => s.command !== null);
    const idleLine = () => {
      const el = document.createElement('span');
      el.className = 't-line';
      el.innerHTML = `${firstCmd ? firstCmd.promptHTML : ''}<span class="t-cursor"></span>`;
      return el;
    };

    if (reduceMotion || !hasIO) {
      out.append(idleLine());
      return;
    }

    let run = 0;
    async function play() {
      const id = ++run;
      out.innerHTML = '';
      for (const step of script) {
        if (id !== run) return;
        const line = document.createElement('span');
        line.className = `${step.className} is-new`;
        if (step.command !== null) {
          line.innerHTML = `${step.promptHTML}<span class="t-cmd"></span><span class="t-cursor"></span>`;
          out.append(line);
          const cmd = line.querySelector('.t-cmd');
          await sleep(480);
          for (const ch of step.command) {
            if (id !== run) return;
            cmd.textContent += ch;
            await sleep(34 + Math.random() * 46);
          }
          await sleep(260);
          const cursor = line.querySelector('.t-cursor');
          if (cursor) cursor.remove();
        } else {
          await sleep(step.delay);
          if (id !== run) return;
          line.innerHTML = step.html;
          out.append(line);
        }
      }
      if (id === run) out.append(idleLine());
    }

    out.innerHTML = '';
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      setTimeout(play, 500);
    }, { threshold: 0.35 });
    onLoad(() => io.observe(out));
    const replay = $('[data-terminal-replay]');
    if (replay) replay.addEventListener('click', play);
  }

  /* ------------------------------------------------------------------------
   * Live Ethereum data (block number, base fee, sparkline)
   * --------------------------------------------------------------------- */
  function initChain() {
    const blockEls = $$('[data-chain-block]');
    if (!blockEls.length) return;
    const statusEl = $('[data-chain-status]');
    const gasEl = $('[data-chain-gas]');
    const sparkLine = $('[data-chain-spark]');
    const sparkFill = $('[data-chain-spark-fill]');
    const history = [];
    let latest = 0;
    let mode = 'loading';
    let timer = 0;
    let rpcIndex = 0;
    let inflight = false;

    const fmtBlock = (n) => `#${n.toLocaleString('en-US')}`;
    const fmtGwei = (g) => (g >= 100 ? g.toFixed(0) : g >= 10 ? g.toFixed(1) : g >= 1 ? g.toFixed(2) : g.toFixed(3));

    function setMode(next) {
      if (mode === next) return;
      mode = next;
      if (!statusEl) return;
      statusEl.dataset.state = next;
      const label = statusEl.querySelector('span');
      if (label) label.textContent = next === 'live' ? 'Live' : 'Simulated';
      statusEl.title = next === 'live'
        ? 'Live data from Ethereum mainnet via a public RPC'
        : 'Public RPCs are unreachable, so this is an estimate';
    }

    async function rpc(url, method, params) {
      const ctrl = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 6000);
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          signal: ctrl.signal,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.error || !json.result) throw new Error((json.error && json.error.message) || 'Empty result');
        return json.result;
      } finally {
        clearTimeout(timeout);
      }
    }

    function record(n, fee) {
      const existing = history.find((item) => item.n === n);
      if (existing) existing.fee = fee; else history.push({ n, fee });
      history.sort((a, b) => a.n - b.n);
      while (history.length > 24) history.shift();
    }

    async function fetchLive() {
      for (let k = 0; k < CONFIG.rpcUrls.length; k++) {
        const i = (rpcIndex + k) % CONFIG.rpcUrls.length;
        try {
          const fh = await rpc(CONFIG.rpcUrls[i], 'eth_feeHistory', ['0x14', 'latest', []]);
          const oldest = parseInt(fh.oldestBlock, 16);
          const count = fh.gasUsedRatio.length;
          const fees = fh.baseFeePerGas.map((x) => parseInt(x, 16) / 1e9);
          if (!count || Number.isNaN(oldest)) throw new Error('Malformed fee history');
          for (let b = 0; b < count; b++) record(oldest + b, fees[b]);
          rpcIndex = i;
          return { block: oldest + count - 1, fee: fees[count - 1] };
        } catch (_) {
          // Try the next endpoint.
        }
      }
      throw new Error('All RPC endpoints failed');
    }

    function simulate() {
      const estimate = CONFIG.anchor.block + Math.floor((Date.now() / 1000 - CONFIG.anchor.time) / CONFIG.slotSeconds);
      let fee = history.length ? history[history.length - 1].fee : 0.12 + Math.random() * 0.2;
      const from = history.length ? history[history.length - 1].n + 1 : estimate - 19;
      for (let n = from; n <= estimate; n++) {
        fee = clamp(fee * (1 + (Math.random() - 0.5) * 0.24), 0.05, 2);
        record(n, fee);
      }
      return { block: Math.max(estimate, latest), fee: history[history.length - 1].fee };
    }

    function drawSpark() {
      if (!sparkLine || history.length < 2) return;
      const W = 120;
      const H = 36;
      const pad = 3;
      const fees = history.map((item) => item.fee);
      const min = Math.min(...fees);
      const span = Math.max(...fees) - min || 1;
      const d = fees.map((f, i) => {
        const x = (i / (fees.length - 1)) * W;
        const y = H - pad - ((f - min) / span) * (H - pad * 2);
        return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ');
      sparkLine.setAttribute('d', d);
      if (sparkFill) sparkFill.setAttribute('d', `${d} L${W} ${H} L0 ${H} Z`);
    }

    function render({ block, fee }) {
      const isNew = block !== latest;
      blockEls.forEach((el) => {
        el.textContent = fmtBlock(block);
        if (isNew && latest && !reduceMotion) {
          el.classList.remove('is-tick');
          void el.offsetWidth;
          el.classList.add('is-tick');
        }
      });
      if (gasEl) gasEl.textContent = `${fmtGwei(fee)} gwei`;
      drawSpark();
      if (isNew && latest) document.dispatchEvent(new CustomEvent('chain:block', { detail: { block } }));
      latest = block;
    }

    function schedule() {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(tick, CONFIG.pollMs);
    }

    async function tick() {
      if (inflight) return;
      inflight = true;
      clearTimeout(timer);
      try {
        render(await fetchLive());
        setMode('live');
      } catch (_) {
        render(simulate());
        setMode('sim');
      } finally {
        inflight = false;
        schedule();
      }
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearTimeout(timer); else tick();
    });
    onLoad(() => setTimeout(tick, 600));
  }

  /* ------------------------------------------------------------------------
   * Work: stacked cards that recede as the next one slides over
   * --------------------------------------------------------------------- */
  function initWorkStack() {
    const cards = $$('.work-card');
    if (cards.length < 2) return;
    const desktop = window.matchMedia('(min-width: 961px)');
    const list = cards[0].parentElement;
    let active = false;
    const reset = () => cards.forEach((card) => {
      card.firstElementChild.style.removeProperty('--scale');
      card.firstElementChild.style.removeProperty('--dim');
    });
    const update = () => {
      const enabled = desktop.matches && !reduceMotion;
      if (!enabled) {
        if (active) { reset(); active = false; }
        return;
      }
      active = true;
      const box = list.getBoundingClientRect();
      if (box.bottom < -200 || box.top > window.innerHeight + 200) return;
      // Read every measurement first, then write, so the browser lays out once per frame.
      const metrics = cards.map((card) => ({ top: card.getBoundingClientRect().top, height: card.offsetHeight }));
      cards.forEach((card, i) => {
        const next = metrics[i + 1];
        const progress = next ? clamp((metrics[i].top + metrics[i].height - next.top) / metrics[i].height, 0, 1) : 0;
        card.firstElementChild.style.setProperty('--scale', (1 - progress * 0.06).toFixed(4));
        card.firstElementChild.style.setProperty('--dim', (progress * 0.6).toFixed(3));
      });
    };
    onScrollFrame(update);
    desktop.addEventListener('change', update);
  }

  /* ------------------------------------------------------------------------
   * Code viewer: tiny highlighter, tabs, and annotations that light up lines
   * --------------------------------------------------------------------- */
  const KEYWORDS = {
    sol: new Set('pragma solidity import from as contract interface library abstract is using for function modifier event error struct enum mapping returns return if else revert emit new delete public private internal external view pure payable virtual override immutable constant memory storage calldata indexed unchecked constructor require assert while do break continue try catch assembly'.split(' ')),
    ts: new Set('import export from as type interface const let var function return if else new instanceof typeof in of async await class extends implements void default switch case break continue throw try catch finally'.split(' ')),
  };
  const SOL_TYPES = /^(?:u?int\d*|bytes\d*|address|bool|string)$/;
  const BUILTINS = new Set(['msg', 'block', 'tx', 'abi', 'this', 'super', 'true', 'false', 'null', 'undefined', 'vm']);
  const TOKEN_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b0x[\da-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:e\d+)?n?\b)|([A-Za-z_$][\w$]*)|([-+*/%=!<>&|^~?:]+)/g;

  function classify(word, lang, after) {
    if ((KEYWORDS[lang] || KEYWORDS.sol).has(word)) return 'kw';
    if (lang === 'ts' && /^\??:/.test(after)) return 'prop';
    if (BUILTINS.has(word)) return 'lit';
    if (lang === 'sol' && SOL_TYPES.test(word)) return 'ty';
    if (/^[A-Z]/.test(word)) return 'ty';
    if (/^\s*\(/.test(after)) return 'fn';
    return '';
  }

  function highlight(source, lang) {
    const src = source.replace(/\s+$/, '');
    const parts = [];
    let last = 0;
    let m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(src))) {
      if (m.index > last) parts.push(['', src.slice(last, m.index)]);
      const [text, comment, string, number, word, op] = m;
      let cls = '';
      if (comment) cls = 'com';
      else if (string) cls = 'str';
      else if (number) cls = 'num';
      else if (op) cls = 'op';
      else if (word) cls = classify(word, lang, src.slice(TOKEN_RE.lastIndex, TOKEN_RE.lastIndex + 3));
      parts.push([cls, text]);
      last = TOKEN_RE.lastIndex;
    }
    if (last < src.length) parts.push(['', src.slice(last)]);

    const lines = [[]];
    parts.forEach(([cls, text]) => {
      text.split('\n').forEach((piece, i) => {
        if (i > 0) lines.push([]);
        if (piece) lines[lines.length - 1].push(cls ? `<span class="tk-${cls}">${escapeHTML(piece)}</span>` : escapeHTML(piece));
      });
    });
    return lines.map((line, i) => `<span class="ln" data-line="${i + 1}">${line.join('') || ' '}</span>`).join('');
  }

  function initCode() {
    const section = $('#craft');
    if (!section) return;
    let highlighted = false;
    const highlightAll = () => {
      if (highlighted) return;
      highlighted = true;
      $$('code[data-lang]', section).forEach((code) => {
        code.innerHTML = highlight(code.textContent, code.dataset.lang);
      });
    };
    if (hasIO) {
      const io = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        highlightAll();
      }, { rootMargin: '1200px 0px' });
      io.observe(section);
    } else {
      highlightAll();
    }

    const tabs = $$('[role="tab"]', section);
    const statusText = $('.code-window__status-text', section);
    const statusMeta = $('.code-window__meta', section);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) {
          panel.classList.toggle('is-active', on);
          panel.inert = !on;
        }
      });
      $$('.notes__list', section).forEach((list) => { list.hidden = list.dataset.for !== tab.getAttribute('aria-controls'); });
      if (statusText) statusText.textContent = tab.dataset.status || '';
      if (statusMeta) statusMeta.textContent = tab.dataset.statusMeta || '';
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab, false));
      tab.addEventListener('keydown', (e) => {
        const target = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
        if (target === undefined) return;
        e.preventDefault();
        select(tabs[(target + tabs.length) % tabs.length], true);
      });
    });

    const parseLines = (spec) => {
      const set = new Set();
      spec.split(',').forEach((part) => {
        const [a, b] = part.split('-').map(Number);
        if (Number.isNaN(a)) return;
        for (let n = a; n <= (b || a); n++) set.add(n);
      });
      return set;
    };
    let pinned = null;
    $$('.note', section).forEach((note) => {
      const lines = parseLines(note.dataset.lines || '');
      const panel = document.getElementById(note.closest('.notes__list').dataset.for);
      if (!panel) return;
      const on = () => {
        highlightAll();
        $$('.note.is-active', section).forEach((n) => { if (n !== note) n.classList.remove('is-active'); });
        note.classList.add('is-active');
        panel.classList.add('has-hl');
        $$('.ln', panel).forEach((ln) => ln.classList.toggle('is-hl', lines.has(Number(ln.dataset.line))));
      };
      const off = () => {
        if (pinned === note) return;
        note.classList.remove('is-active');
        panel.classList.remove('has-hl');
        $$('.ln.is-hl', panel).forEach((ln) => ln.classList.remove('is-hl'));
      };
      note.addEventListener('mouseenter', on);
      note.addEventListener('mouseleave', off);
      note.addEventListener('focus', on);
      note.addEventListener('blur', () => { pinned = null; off(); });
      note.addEventListener('click', () => {
        pinned = note;
        on();
        const first = $('.ln.is-hl', panel);
        if (first) {
          const r = first.getBoundingClientRect();
          if (r.top < 80 || r.bottom > window.innerHeight) first.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }
      });
      note.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); note.click(); }
      });
    });
  }

  function initSvgAnimations() {
    const svgs = $$('svg.amm, svg.xchain').filter((svg) => typeof svg.pauseAnimations === 'function');
    if (!svgs.length) return;
    if (reduceMotion || !hasIO) {
      if (reduceMotion) svgs.forEach((svg) => svg.pauseAnimations());
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.unpauseAnimations(); else entry.target.pauseAnimations();
      });
    });
    svgs.forEach((svg) => io.observe(svg));
  }

  /* ------------------------------------------------------------------------
   * Process timeline progress
   * --------------------------------------------------------------------- */
  function initProcess() {
    const list = $('#steps');
    if (!list) return;
    const steps = $$('.step', list);
    onScrollFrame(() => {
      const rect = list.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      const anchor = window.innerHeight * 0.55;
      const progress = clamp((anchor - rect.top - 24) / Math.max(1, rect.height - 48), 0, 1);
      const reached = steps.map((step) => {
        const node = step.firstElementChild.getBoundingClientRect();
        return node.top + node.height / 2 <= anchor;
      });
      list.style.setProperty('--progress', progress.toFixed(4));
      steps.forEach((step, i) => step.classList.toggle('is-active', reached[i]));
    });
  }

  /* ------------------------------------------------------------------------
   * About: local time
   * --------------------------------------------------------------------- */
  function initClock() {
    const els = $$('[data-local-time]');
    if (!els.length) return;
    const update = () => els.forEach((el) => {
      const label = el.dataset.tzLabel; // e.g. "SGT (UTC+8)"; falls back to the browser's short zone name
      try {
        const time = new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit', minute: '2-digit', timeZone: el.dataset.tz || 'UTC', ...(label ? {} : { timeZoneName: 'short' }),
        }).format(new Date());
        el.textContent = label ? `${time} ${label}` : time;
      } catch (_) {
        el.textContent = `${new Date().toISOString().slice(11, 16)} UTC`;
      }
    });
    update();
    setInterval(update, 20000);
  }

  /* ------------------------------------------------------------------------
   * Contact: copy buttons, prefill links, form submission
   * --------------------------------------------------------------------- */
  function initCopy() {
    document.addEventListener('click', async (e) => {
      const btn = e.target instanceof Element ? e.target.closest('[data-copy]') : null;
      if (!btn) return;
      e.preventDefault();
      const text = btn.dataset.copy;
      const ok = await copyText(text);
      toast(ok ? `Copied ${text}` : 'Copy failed. Please copy it manually.', ok);
      if (ok) {
        btn.classList.add('is-copied');
        setTimeout(() => btn.classList.remove('is-copied'), 1600);
      }
    });
  }

  function initPrefill() {
    const form = $('#contact-form');
    if (!form) return;
    document.addEventListener('click', (e) => {
      const trigger = e.target instanceof Element ? e.target.closest('[data-prefill-need], [data-prefill-message]') : null;
      if (!trigger) return;
      const need = trigger.dataset.prefillNeed;
      if (need) {
        const box = $$('input[name="need"]', form).find((input) => input.value === need);
        if (box) box.checked = true;
      }
      const message = trigger.dataset.prefillMessage;
      const textarea = form.elements.namedItem('message');
      if (message && textarea && !textarea.value.trim()) textarea.value = message;
    });
  }

  function initForm() {
    const form = $('#contact-form');
    if (!form) return;
    const fields = $('.form__fields', form);
    const success = $('.form__success', form);
    const status = $('.form__status', form);
    const submit = $('.form__submit', form);
    const required = ['name', 'email', 'message'].map((name) => form.elements.namedItem(name)).filter(Boolean);
    const isValid = (input) => input.value.trim() !== '' && input.checkValidity();

    form.addEventListener('input', (e) => {
      const field = e.target.closest ? e.target.closest('.field') : null;
      if (field && field.classList.contains('is-invalid') && isValid(e.target)) {
        field.classList.remove('is-invalid');
        e.target.removeAttribute('aria-invalid');
      }
    });

    const showSuccess = (title, text, allowHTML) => {
      $('[data-success-title]', success).textContent = title;
      const p = $('[data-success-text]', success);
      if (allowHTML) p.innerHTML = text; else p.textContent = text;
      fields.hidden = true;
      success.hidden = false;
      success.focus();
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      status.textContent = '';
      let firstInvalid = null;
      required.forEach((input) => {
        const ok = isValid(input);
        input.closest('.field').classList.toggle('is-invalid', !ok);
        if (ok) input.removeAttribute('aria-invalid'); else input.setAttribute('aria-invalid', 'true');
        if (!ok && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) {
        status.textContent = 'Please complete the highlighted fields.';
        firstInvalid.focus();
        return;
      }

      const data = new FormData(form);
      const email = form.dataset.email || '';
      const safeEmail = escapeHTML(email);
      const endpoint = (form.dataset.endpoint || '').trim();
      const name = String(data.get('name') || '').trim();
      submit.classList.add('is-loading');
      submit.disabled = true;
      try {
        if (endpoint) {
          const res = await fetch(endpoint, { method: 'POST', body: data, headers: { Accept: 'application/json' } });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          showSuccess(`Thanks, ${name.split(/\s+/)[0]}!`, "Your message is in. I'll reply within 24 hours, usually much sooner.", false);
        } else {
          const company = String(data.get('company') || '').trim();
          const needs = data.getAll('need').join(', ');
          const budget = String(data.get('budget') || '');
          const body = [`Name: ${name}`, `Email: ${String(data.get('email')).trim()}`];
          if (company) body.push(`Company / project: ${company}`);
          if (needs) body.push(`Looking for: ${needs}`);
          if (budget) body.push(`Budget: ${budget}`);
          body.push('', String(data.get('message') || '').trim());
          const subject = `Project inquiry: ${company || name}`;
          window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.join('\n'))}`;
          showSuccess('Almost there!', `Your email app should open with everything filled in. Just hit send. If nothing happened, write to <a href="mailto:${safeEmail}">${safeEmail}</a>.`, true);
        }
      } catch (_) {
        status.innerHTML = `Something went wrong sending your message. Please email <a href="mailto:${safeEmail}">${safeEmail}</a> directly.`;
      } finally {
        submit.classList.remove('is-loading');
        submit.disabled = false;
      }
    });

    const reset = $('[data-form-reset]', form);
    if (reset) {
      reset.addEventListener('click', () => {
        form.reset();
        success.hidden = true;
        fields.hidden = false;
        const first = form.elements.namedItem('name');
        if (first) first.focus();
      });
    }
  }

  /* ------------------------------------------------------------------------
   * Command palette (⌘K / Ctrl+K)
   * --------------------------------------------------------------------- */
  function initPalette() {
    const palette = $('#palette');
    const input = $('#palette-input');
    const list = $('#palette-list');
    if (!palette || !input || !list) return;

    const link = (name) => {
      const el = $(`[data-link="${name}"]`);
      return el ? el.getAttribute('href') : '';
    };
    const form = $('#contact-form');
    const email = form ? form.dataset.email || '' : '';
    const goTo = (id, then) => () => {
      const target = document.getElementById(id);
      if (!target) return;
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (then) setTimeout(then, reduceMotion ? 0 : 700);
    };
    const openUrl = (url) => () => { if (url) window.open(url, '_blank', 'noopener'); };

    const items = [
      { group: 'Navigate', label: 'Services', icon: 'i-layers', run: goTo('services'), keywords: 'what offer help' },
      { group: 'Navigate', label: 'Selected work', icon: 'i-box', run: goTo('work'), keywords: 'projects case studies portfolio' },
      { group: 'Navigate', label: 'Code samples', icon: 'i-file-code', run: goTo('craft'), keywords: 'solidity foundry typescript craft tests' },
      { group: 'Navigate', label: 'Process', icon: 'i-route', run: goTo('process'), keywords: 'how timeline steps' },
      { group: 'Navigate', label: 'About', icon: 'i-user', run: goTo('about'), keywords: 'bio stack toolbox experience' },
      { group: 'Navigate', label: 'Engagement models', icon: 'i-briefcase', run: goTo('engage'), keywords: 'pricing retainer review plans' },
      { group: 'Navigate', label: 'FAQ', icon: 'i-help', run: goTo('faq'), keywords: 'questions answers' },
      {
        group: 'Actions', label: 'Start a project', icon: 'i-send', keywords: 'hire contact form inquiry',
        run: goTo('contact', () => { const f = $('#f-name'); if (f) f.focus({ preventScroll: true }); }),
      },
      {
        group: 'Actions', label: 'Copy email address', icon: 'i-copy', hint: email, keywords: 'mail',
        run: async () => { const ok = await copyText(email); toast(ok ? `Copied ${email}` : 'Copy failed', ok); },
      },
      { group: 'Actions', label: 'Book a discovery call', icon: 'i-calendar', run: openUrl(link('calendar')), keywords: 'calendly cal meeting schedule' },
      { group: 'Elsewhere', label: 'GitHub', icon: 'i-github', run: openUrl(link('github')), keywords: 'code repos' },
      { group: 'Elsewhere', label: 'Telegram', icon: 'i-telegram', run: openUrl(link('telegram')), keywords: 'chat message dm' },
    ];

    let filtered = items;
    let active = 0;
    let isOpen = false;
    let lastFocus = null;

    function syncActive() {
      $$('.palette__item', list).forEach((el) => el.setAttribute('aria-selected', String(Number(el.dataset.index) === active)));
      const el = $(`#pal-opt-${active}`, list);
      if (el) {
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
      }
    }

    function render() {
      const q = input.value.trim().toLowerCase();
      filtered = q ? items.filter((it) => `${it.label} ${it.group} ${it.keywords || ''}`.toLowerCase().includes(q)) : items;
      active = clamp(active, 0, Math.max(0, filtered.length - 1));
      if (!filtered.length) {
        list.innerHTML = `<li class="palette__empty" role="presentation">No results for “${escapeHTML(input.value)}”</li>`;
        input.removeAttribute('aria-activedescendant');
        return;
      }
      let group = '';
      let markup = '';
      filtered.forEach((it, i) => {
        if (it.group !== group) {
          group = it.group;
          markup += `<li class="palette__group" role="presentation">${escapeHTML(group)}</li>`;
        }
        markup += `<li class="palette__item" id="pal-opt-${i}" role="option" aria-selected="${i === active}" data-index="${i}">`
          + `<svg class="icon" aria-hidden="true"><use href="#${it.icon}"/></svg><span>${escapeHTML(it.label)}</span>`
          + (it.hint ? `<span class="palette__hint">${escapeHTML(it.hint)}</span>` : '')
          + '<svg class="icon palette__enter" aria-hidden="true"><use href="#i-enter"/></svg></li>';
      });
      list.innerHTML = markup;
      syncActive();
    }

    function open() {
      if (isOpen) return;
      isOpen = true;
      lastFocus = document.activeElement;
      palette.hidden = false;
      void palette.offsetWidth;
      palette.classList.add('is-open');
      document.body.classList.add('palette-open');
      input.value = '';
      active = 0;
      render();
      input.focus({ preventScroll: true });
    }

    function close(restoreFocus = true) {
      if (!isOpen) return;
      isOpen = false;
      palette.classList.remove('is-open');
      document.body.classList.remove('palette-open');
      setTimeout(() => { if (!isOpen) palette.hidden = true; }, 250);
      if (restoreFocus && lastFocus instanceof HTMLElement) lastFocus.focus({ preventScroll: true });
    }

    function run(index) {
      const item = filtered[index];
      if (!item) return;
      close(false);
      item.run();
    }

    list.addEventListener('mousemove', (e) => {
      const el = e.target instanceof Element ? e.target.closest('.palette__item') : null;
      if (el && Number(el.dataset.index) !== active) {
        active = Number(el.dataset.index);
        syncActive();
      }
    });
    list.addEventListener('click', (e) => {
      const el = e.target instanceof Element ? e.target.closest('.palette__item') : null;
      if (el) run(Number(el.dataset.index));
    });
    input.addEventListener('input', () => { active = 0; render(); });
    $$('[data-palette-open]').forEach((btn) => btn.addEventListener('click', open));
    $$('[data-palette-close]', palette).forEach((el) => el.addEventListener('click', () => close()));

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) close(); else open();
        return;
      }
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowDown' && filtered.length) { e.preventDefault(); active = (active + 1) % filtered.length; syncActive(); }
      else if (e.key === 'ArrowUp' && filtered.length) { e.preventDefault(); active = (active - 1 + filtered.length) % filtered.length; syncActive(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(active); }
      else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
    });
  }

  /* ------------------------------------------------------------------------
   * Mobile: sticky "Start a project" bar between hero and contact
   * --------------------------------------------------------------------- */
  function initMobileCta() {
    const bar = $('#mobile-cta');
    if (!bar || !hasIO) return;
    const state = { hero: true, contact: false, footer: false };
    const update = () => bar.classList.toggle('is-visible', !state.hero && !state.contact && !state.footer);
    [['hero', $('.hero'), { rootMargin: '0px 0px -35% 0px' }], ['contact', $('#contact'), {}], ['footer', $('.footer'), {}]]
      .forEach(([key, el, opts]) => {
        if (!el) return;
        new IntersectionObserver(([entry]) => { state[key] = entry.isIntersecting; update(); }, opts).observe(el);
      });
  }

  /* ------------------------------------------------------------------------
   * Boot
   * --------------------------------------------------------------------- */
  [
    initModKey, initYear, initNav, initMobileMenu, initScrollSpy,
    initReveal, initScramble, initCounters, initSpotlight, initMagnetic, initTilt, initNetwork,
    initTerminal, initChain, initWorkStack, initCode, initSvgAnimations, initProcess, initClock,
    initCopy, initPrefill, initForm, initPalette, initMobileCta,
  ].forEach((init) => {
    try {
      init();
    } catch (err) {
      console.error(`[portfolio] ${init.name} failed`, err);
    }
  });
})();
