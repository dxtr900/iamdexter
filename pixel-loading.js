/**
 * On-scroll pixelated image loading (Codrops) for project tiles + Lenis smooth scroll.
 * @see https://github.com/codrops/ImagePixelLoading
 */
(() => {
  const REDUCED = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const PX_VALUES = [1, 2, 4, 9, 100];
  const instances = new Map();

  let lenis = null;

  function photoSrc(tile) {
    return tile?.querySelector('img.project-photo, img.about-portrait')?.getAttribute('src') || '';
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = src;
    });
  }

  class ProjectPixel {
    constructor(tile, src) {
      this.tile = tile;
      this.src = src;
      this.wrap = null;
      this.canvas = null;
      this.ctx = null;
      this.img = null;
      this.imgRatio = 1;
      this.pxIndex = 0;
      this.animated = false;
      this.observer = null;
      this._resize = () => { this.setCanvasSize(); this.render(); };
    }

    async init() {
      const src = this.src;
      if (!src) return false;

      try {
        this.img = await loadImage(src);
      } catch {
        return false;
      }

      this.wrap = document.createElement('div');
      this.wrap.className = 'pixel-canvas-wrap';
      this.wrap.setAttribute('aria-hidden', 'true');

      this.canvas = document.createElement('canvas');
      this.wrap.appendChild(this.canvas);
      this.tile.appendChild(this.wrap);

      this.ctx = this.canvas.getContext('2d');
      this.tile.classList.add('pixel-tile');

      this.imgRatio = this.img.width / this.img.height;
      this.setCanvasSize();
      this.pxIndex = 0;
      this.render();
      this.bindObserver();
      window.addEventListener('resize', this._resize);
      return true;
    }

    setCanvasSize() {
      if (!this.wrap || !this.ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = this.wrap.offsetWidth;
      const h = this.wrap.offsetHeight;
      if (w > 0 && h > 0) {
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }

    render() {
      if (!this.wrap || !this.ctx || !this.img) return;
      const offsetWidth = this.wrap.offsetWidth;
      const offsetHeight = this.wrap.offsetHeight;
      if (!offsetWidth || !offsetHeight) return;

      const w = offsetWidth + offsetWidth * 0.05;
      const h = offsetHeight + offsetHeight * 0.05;

      let newWidth = w;
      let newHeight = h;
      let newX = 0;

      if (newWidth / newHeight > this.imgRatio) {
        newHeight = Math.round(w / this.imgRatio);
      } else {
        newWidth = Math.round(h * this.imgRatio);
        newX = (w - newWidth) / 2;
      }

      const pxFactor = PX_VALUES[this.pxIndex];
      const size = pxFactor * 0.01;
      const smooth = size === 1;

      this.ctx.mozImageSmoothingEnabled = smooth;
      this.ctx.webkitImageSmoothingEnabled = smooth;
      this.ctx.imageSmoothingEnabled = smooth;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(this.img, 0, 0, w * size, h * size);
      this.ctx.drawImage(this.canvas, 0, 0, w * size, h * size, newX, 0, newWidth, newHeight);
    }

    reveal() {
      if (!this.wrap) return false;
      this.setCanvasSize();
      if (!this.wrap.offsetWidth || !this.wrap.offsetHeight) {
        this.animated = true;
        this.tile.classList.add('pixel-skip', 'pixel-done');
        return false;
      }
      this.wrap.style.opacity = '1';
      this.tile.classList.add('pixel-active');
      return true;
    }

    startReveal() {
      this.observer?.disconnect();
      this.observer = null;
      if (!this.reveal()) return;
      this.animatePixels();
    }

    animatePixels() {
      if (this.animated) return;
      this.animated = true;

      const step = () => {
        if (this.pxIndex < PX_VALUES.length) {
          this.render();
          this.pxIndex++;
          setTimeout(step, this.pxIndex === 1 ? 300 : 80);
        } else {
          this.pxIndex = PX_VALUES.length - 1;
          this.tile.classList.add('pixel-done');
          this.finishReveal();
        }
      };
      step();
    }

    finishReveal() {
      if (this.wrap) {
        this.wrap.style.opacity = '0';
        this.wrap.style.transition = 'opacity 200ms ease';
      }
      this.tile.classList.remove('pixel-active');
      setTimeout(() => {
        this.wrap?.remove();
        this.wrap = null;
        this.canvas = null;
        this.ctx = null;
      }, 220);
    }

    bindObserver() {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            this.startReveal();
          });
        },
        { root: null, rootMargin: '20% 0px', threshold: 0.01 }
      );
      this.observer.observe(this.tile);
      const rect = this.tile.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        this.startReveal();
      }
    }

    destroy() {
      window.removeEventListener('resize', this._resize);
      this.observer?.disconnect();
      this.wrap?.remove();
      if (this.tile.dataset.pixelSrc !== this.src) return;
      this.tile.classList.remove('pixel-tile', 'pixel-active', 'pixel-done');
      delete this.tile.dataset.pixelInit;
    }
  }

  async function initTile(tile) {
    const src = photoSrc(tile);
    if (!src) return;
    if (tile.dataset.pixelInit === '1' && tile.dataset.pixelSrc === src) return;

    const existing = instances.get(tile);
    if (existing) existing.destroy();

    tile.dataset.pixelInit = '1';
    tile.dataset.pixelSrc = src;

    if (REDUCED) {
      tile.classList.add('pixel-skip');
      return;
    }

    const pixel = new ProjectPixel(tile, src);
    const ok = await pixel.init();
    if (tile.dataset.pixelSrc !== src) {
      pixel.destroy();
      return;
    }
    if (ok) instances.set(tile, pixel);
    else {
      pixel.destroy();
      tile.classList.add('pixel-skip');
      tile.dataset.pixelInit = '1';
      tile.dataset.pixelSrc = src;
    }
  }

  function initProjectPixels() {
    document.querySelectorAll('#projects .project-tile, #about .about-photo').forEach((tile) => initTile(tile));
  }

  function unlockPageScroll() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    lenis?.start();
  }

  function scrollToAnchor(href) {
    const target = document.querySelector(href);
    if (!target) return false;
    // Mobile menu locks body scroll / stops Lenis — unlock before scrolling.
    unlockPageScroll();
    if (lenis) {
      lenis.scrollTo(target, { offset: -88, duration: 1.4 });
    } else {
      const top = target.getBoundingClientRect().top + window.pageYOffset - 88;
      window.scrollTo({ top, behavior: REDUCED ? 'auto' : 'smooth' });
    }
    return true;
  }

  function initSmoothScroll() {
    // Delegate so links still work after DC re-renders the mobile menu.
    document.addEventListener('click', (e) => {
      const link = e.target.closest?.('a[href^="#"]');
      if (!link || link.hasAttribute('download') || link.target === '_blank') return;
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      if (!document.querySelector(href)) return;
      e.preventDefault();
      if (scrollToAnchor(href) && history.pushState) {
        history.pushState(null, '', href);
      }
    });

    if (REDUCED || typeof Lenis === 'undefined') return;

    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, orientation: 'vertical' });

    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    const cmsObserver = new MutationObserver(() => {
      const hidden = document.body.style.overflow === 'hidden';
      if (hidden) lenis.stop();
      else lenis.start();
    });
    cmsObserver.observe(document.body, { attributes: true, attributeFilter: ['style'] });
  }

  const THEME_COLORS = {
    light: { bg: '#FAFAFA', surface: '#FFFFFF', surface2: '#F4F4F5', ink: '#18181B' },
    dark: { bg: '#09090B', surface: '#18181B', surface2: '#27272A', ink: '#FAFAFA' },
  };

  let themeAnimating = false;

  /**
   * Pixelated radial wipe from the theme button: covers the page with
   * outgoing-theme pixels, swaps theme underneath, then dissolves cells
   * outward while sharpening (large → small blocks).
   */
  function animateThemeSwitch(fromTheme, toTheme, originEl) {
    if (REDUCED || themeAnimating) {
      return Promise.resolve(false);
    }

    themeAnimating = true;

    return new Promise((resolve) => {
      const from = THEME_COLORS[fromTheme] || THEME_COLORS.light;
      const to = THEME_COLORS[toTheme] || THEME_COLORS.dark;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let ox = vw / 2;
      let oy = 24;
      if (originEl?.getBoundingClientRect) {
        const r = originEl.getBoundingClientRect();
        ox = r.left + r.width / 2;
        oy = r.top + r.height / 2;
      }

      const canvas = document.createElement('canvas');
      canvas.className = 'theme-pixel-canvas';
      canvas.width = Math.floor(vw * dpr);
      canvas.height = Math.floor(vh * dpr);
      canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:10000;pointer-events:none;';
      document.body.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      document.documentElement.classList.add('theme-pixelating');

      const maxDist = Math.hypot(
        Math.max(ox, vw - ox),
        Math.max(oy, vh - oy)
      ) + 80;

      const cellSizes = [48, 28, 16, 10, 6];
      let stage = 0;
      const duration = 720;

      // Stable jitter so cells don't flicker between frames.
      const jitter = (col, row, seed) => {
        const n = Math.sin(col * 12.9898 + row * 78.233 + seed * 43.758) * 43758.5453;
        return n - Math.floor(n);
      };

      const paint = (cell, t) => {
        ctx.clearRect(0, 0, vw, vh);
        const cols = Math.ceil(vw / cell) + 1;
        const rows = Math.ceil(vh / cell) + 1;

        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            const x = col * cell;
            const y = row * cell;
            const cx = x + cell / 2;
            const cy = y + cell / 2;
            const dist = Math.hypot(cx - ox, cy - oy);
            const threshold = t * maxDist;
            const edge = cell * 1.8;
            const j = jitter(col, row, stage) * edge;

            // Cells inside the expanding radius are cleared (reveal new theme).
            if (dist + j < threshold) continue;

            // Mix of outgoing palette for a textured pixel field.
            const roll = jitter(col, row, 7);
            let fill = from.bg;
            if (roll > 0.92) fill = from.ink;
            else if (roll > 0.78) fill = from.surface2;
            else if (roll > 0.55) fill = from.surface;

            // Near the wipe edge, flash a few incoming-theme pixels.
            if (dist - threshold < edge && jitter(col, row, 3) > 0.7) {
              fill = jitter(col, row, 11) > 0.5 ? to.surface2 : to.bg;
            }

            ctx.fillStyle = fill;
            ctx.fillRect(x, y, cell + 0.5, cell + 0.5);
          }
        }
      };

      // Cover first, then signal caller to swap theme under the overlay.
      paint(cellSizes[0], 0);

      requestAnimationFrame(() => {
        resolve(true);
        const start = performance.now();

        const tick = (now) => {
          const progress = Math.min(1, (now - start) / duration);
          // Ease-out cubic + slight hold at the start for the pixel "hit".
          const eased = progress < 0.08
            ? 0
            : 1 - Math.pow(1 - (progress - 0.08) / 0.92, 3);

          stage = Math.min(
            cellSizes.length - 1,
            Math.floor(progress * cellSizes.length)
          );
          paint(cellSizes[stage], eased);

          if (progress < 1) {
            requestAnimationFrame(tick);
          } else {
            canvas.remove();
            document.documentElement.classList.remove('theme-pixelating');
            themeAnimating = false;
          }
        };

        requestAnimationFrame(tick);
      });
    });
  }

  function initTooltips() {
    document.querySelectorAll('.t-tt-group').forEach((group) => {
      const tip = group.querySelector('.t-tt');
      const text = tip?.querySelector('.t-tt-text');
      if (!tip || !text) return;
      const triggers = [...group.querySelectorAll('.t-tt-trigger')];

      function hide() {
        tip.setAttribute('data-show', 'false');
        tip.setAttribute('aria-hidden', 'true');
      }

      function place(trigger) {
        const showing = tip.getAttribute('data-show') === 'true';
        text.textContent = trigger.getAttribute('data-tooltip') || '';
        const cs = getComputedStyle(tip);
        const width = Math.ceil(
          text.scrollWidth + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
        );
        const g = group.getBoundingClientRect();
        const r = trigger.getBoundingClientRect();
        const x = r.left - g.left + r.width / 2 - width / 2;
        if (!showing) {
          tip.style.transition = 'none';
          tip.style.width = `${width}px`;
          tip.style.setProperty('--tt-x', `${x}px`);
          void tip.offsetWidth;
          tip.style.transition = '';
        } else {
          tip.style.width = `${width}px`;
          tip.style.setProperty('--tt-x', `${x}px`);
        }
        tip.setAttribute('data-show', 'true');
        tip.setAttribute('aria-hidden', 'false');
      }

      triggers.forEach((t) => {
        t.addEventListener('pointerenter', () => place(t));
        t.addEventListener('focus', () => place(t));
        t.addEventListener('blur', hide);
      });
      group.addEventListener('pointerleave', hide);
    });
  }

  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const name = form.querySelector('#f-name');
    const email = form.querySelector('#f-email');
    const message = form.querySelector('#f-msg');
    const submit = form.querySelector('#contact-submit');
    const wrap = form.querySelector('.t-input-wrap');
    const input = wrap?.querySelector('.t-input');
    if (!name || !email || !message || !submit || !wrap || !input) return;

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    const filled = (el) => el.value.trim().length > 0;
    const emailValid = () => EMAIL_RE.test(email.value.trim());

    const cs = getComputedStyle(document.documentElement);
    const ms = (token, fb) => {
      const v = parseFloat(cs.getPropertyValue(token));
      return Number.isFinite(v) ? v : fb;
    };

    function syncSubmit() {
      const ready = filled(name) && filled(email) && filled(message);
      submit.disabled = !ready;
    }

    function clearEmailError() {
      if (wrap._revertTimer) {
        clearTimeout(wrap._revertTimer);
        wrap._revertTimer = null;
      }
      wrap.classList.remove('is-error');
      input.classList.remove('is-error', 'is-shaking');
    }

    function showEmailError() {
      wrap.classList.add('is-error');
      input.classList.add('is-error');

      input.classList.remove('is-shaking');
      void input.offsetWidth;
      input.classList.add('is-shaking');

      const shakeMs =
        ms('--shake-dur-a', 80) * 2 +
        ms('--shake-dur-b', 60) * 2;
      setTimeout(() => input.classList.remove('is-shaking'), shakeMs + 20);

      if (wrap._revertTimer) clearTimeout(wrap._revertTimer);
      const hold = ms('--revert-hold', 3000);
      wrap._revertTimer = setTimeout(() => {
        wrap._revertTimer = null;
        wrap.classList.remove('is-error');
        input.classList.remove('is-error');
      }, shakeMs + hold);
    }

    email.addEventListener('blur', () => {
      if (!filled(email)) {
        clearEmailError();
        return;
      }
      if (!emailValid()) showEmailError();
    });

    email.addEventListener('input', () => {
      clearEmailError();
      syncSubmit();
    });
    name.addEventListener('input', syncSubmit);
    message.addEventListener('input', syncSubmit);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (submit.disabled) return;
      if (!emailValid()) {
        showEmailError();
        email.focus();
        return;
      }
    });

    syncSubmit();
  }

  function initRecommendations() {
    const root = document.querySelector('.rec-carousel');
    if (!root) return;

    const track = () => root.querySelector('.rec-track');
    const originals = () => [...root.querySelectorAll('.rec-slide:not(.rec-clone)')];
    const dots = () => [...root.querySelectorAll('.rec-progress-btn')];
    const ready = () => {
      const list = originals();
      return list.length > 0 && list.length === dots().length && list.every((slide) => {
        const name = slide.querySelector('.rec-name')?.textContent?.trim() || '';
        return name && !name.includes('{{');
      });
    };

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const DURATION = 3000;
    const PEEK = 2;
    let index = 0;
    let timer = 0;
    let lastKey = '';
    let wrapTo = null;

    const offset = () => Number(track()?.dataset.recOffset || 0);

    const restart = () => {
      clearTimeout(timer);
      if (reduce || document.hidden || root.classList.contains('is-paused') || !ready()) return;
      timer = window.setTimeout(() => go(current() + 1), DURATION);
    };

    const current = () => {
      const i = originals().findIndex((slide) => slide.classList.contains('is-active'));
      return i < 0 ? index : i;
    };

    const setX = (pos, instant) => {
      const el = track();
      if (!el) return;
      if (instant || reduce) el.style.transition = 'none';
      el.style.transform = `translate3d(calc(-1 * ${pos} * (var(--rec-card-w) + var(--rec-gap))), 0, 0)`;
      if (instant || reduce) {
        void el.offsetWidth;
        if (!reduce) el.style.transition = '';
      }
    };

    const mark = (logical) => {
      root.querySelectorAll('.rec-slide').forEach((slide) => {
        slide.classList.toggle('is-active', Number(slide.dataset.recIndex) === logical);
      });
      dots().forEach((dot, i) => {
        dot.classList.remove('is-active', 'is-done');
        if (i < logical) dot.classList.add('is-done');
        if (i === logical) {
          void dot.offsetWidth;
          dot.classList.add('is-active');
        }
        dot.setAttribute('aria-selected', i === logical ? 'true' : 'false');
        dot.tabIndex = i === logical ? 0 : -1;
      });
    };

    const go = (next) => {
      const list = originals();
      const controls = dots();
      const n = list.length;
      if (!n || n !== controls.length) return;
      const prev = index;
      let logical;
      let pos;
      let snapPos = null;

      if (next === n) {
        logical = 0;
        pos = offset() + n;
        snapPos = offset();
      } else if (next === -1) {
        logical = n - 1;
        pos = offset() - 1;
        snapPos = offset() + n - 1;
      } else {
        logical = ((next % n) + n) % n;
        pos = offset() + logical;
      }

      if (reduce && snapPos != null) {
        pos = snapPos;
        snapPos = null;
      }

      const step = next === n ? n : next === -1 ? -1 : logical;
      const instant = Math.abs(step - prev) !== 1;
      index = logical;
      wrapTo = !instant && snapPos != null ? snapPos : null;
      setX(pos, instant);
      mark(logical);
      restart();
    };

    const ensureLoop = () => {
      const el = track();
      if (!el) return false;
      const items = originals();
      if (items.length < 2) return false;
      if (el.querySelector('.rec-clone')) return false;
      items.forEach((slide, i) => {
        slide.dataset.recIndex = String(i);
      });
      const cloneOf = (slide) => {
        const copy = slide.cloneNode(true);
        copy.classList.add('rec-clone');
        copy.classList.remove('is-active');
        copy.setAttribute('aria-hidden', 'true');
        return copy;
      };
      const head = items.slice(0, PEEK).map(cloneOf);
      const tail = items.slice(-PEEK).map(cloneOf);
      el.dataset.recOffset = String(PEEK);
      tail.reverse().forEach((copy) => el.insertBefore(copy, el.firstChild));
      head.forEach((copy) => el.appendChild(copy));
      return true;
    };

    const sync = () => {
      if (!ready()) return;
      const key = originals().map((slide) => slide.querySelector('.rec-name')?.textContent?.trim()).join('|');
      const fresh = key !== lastKey;
      lastKey = key;
      const cloned = ensureLoop();
      if (fresh) go(0);
      if (fresh || cloned) document.dispatchEvent(new Event('recs:ready'));
    };

    if (!root._recBound) {
      root._recBound = true;
      const viewport = root.querySelector('.rec-viewport');
      root.addEventListener('click', (e) => {
        if (!ready()) return;
        if (e.target.closest('.rec-prev')) {
          go(current() - 1);
          return;
        }
        if (e.target.closest('.rec-next')) {
          go(current() + 1);
          return;
        }
        const btn = e.target.closest('.rec-progress-btn');
        if (btn) {
          const i = dots().indexOf(btn);
          if (i >= 0) go(i);
          return;
        }
        const slide = e.target.closest('.rec-slide');
        if (!slide) return;
        const i = Number(slide.dataset.recIndex);
        if (Number.isNaN(i)) return;
        const cur = current();
        const n = originals().length;
        const el = track();
        if (slide.classList.contains('rec-clone') && el) {
          const pos = [...el.children].indexOf(slide);
          const curPos = offset() + cur;
          if (pos > curPos && i < cur) go(n);
          else if (pos < curPos && i > cur) go(-1);
          else if (i !== cur) go(i);
          return;
        }
        if (i !== cur) go(i);
      });
      root.addEventListener('keydown', (e) => {
        if (!ready()) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          go(current() - 1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          go(current() + 1);
        }
      });
      track()?.addEventListener('transitionend', (e) => {
        if (e.target !== track() || e.propertyName !== 'transform' || wrapTo == null) return;
        const snap = wrapTo;
        wrapTo = null;
        setX(snap, true);
      });
      let swipeX = 0;
      let swipeY = 0;
      let swipeOn = false;
      let swipeAxis = null;
      const swipeTarget = viewport || root;
      swipeTarget.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        swipeX = e.clientX;
        swipeY = e.clientY;
        swipeOn = true;
        swipeAxis = null;
      });
      swipeTarget.addEventListener('pointermove', (e) => {
        if (!swipeOn) return;
        const dx = e.clientX - swipeX;
        const dy = e.clientY - swipeY;
        if (swipeAxis == null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
          swipeAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        }
      });
      const endSwipe = (e) => {
        if (!swipeOn) return;
        swipeOn = false;
        const dx = e.clientX - swipeX;
        const axis = swipeAxis;
        swipeAxis = null;
        if (axis !== 'x' || Math.abs(dx) < 40 || !ready()) return;
        if (dx < 0) go(current() + 1);
        else go(current() - 1);
      };
      swipeTarget.addEventListener('pointerup', endSwipe);
      swipeTarget.addEventListener('pointercancel', () => {
        swipeOn = false;
        swipeAxis = null;
      });
      const pause = () => {
        root.classList.add('is-paused');
        clearTimeout(timer);
      };
      const resume = () => {
        root.classList.remove('is-paused');
        restart();
      };
      (viewport || root).addEventListener('mouseenter', pause);
      (viewport || root).addEventListener('mouseleave', resume);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) clearTimeout(timer);
        else restart();
      });
      root._recObs = new MutationObserver(sync);
      root._recObs.observe(root, { childList: true, subtree: true });
    }

    sync();
  }

  function initPricingTabs() {
    const bar = document.querySelector('.pricing-tabs');
    if (!bar || bar._tabsBound) return;
    bar._tabsBound = true;
    const pill = bar.querySelector('.t-tabs-pill');
    const tabs = [...bar.querySelectorAll('.t-tab')];
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls'))).filter(Boolean);

    const moveTo = (tab, animate) => {
      if (!pill || !tab) return;
      if (!animate) {
        const prev = pill.style.transition;
        pill.style.transition = 'none';
        pill.style.transform = `translateX(${tab.offsetLeft}px)`;
        pill.style.width = `${tab.offsetWidth}px`;
        void pill.offsetWidth;
        pill.style.transition = prev;
      } else {
        pill.style.transform = `translateX(${tab.offsetLeft}px)`;
        pill.style.width = `${tab.offsetWidth}px`;
      }
    };

    const active = () => tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];

    const show = (tab) => {
      tabs.forEach((t) => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
      panels.forEach((panel) => {
        const on = panel.id === tab.getAttribute('aria-controls');
        panel.classList.toggle('is-active', on);
      });
      moveTo(tab, true);
      document.dispatchEvent(new Event('recs:ready'));
    };

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => show(tab));
    });
    requestAnimationFrame(() => moveTo(active(), false));
    window.addEventListener('resize', () => moveTo(active(), false));
  }

  function initPricingCompare() {
    document.querySelectorAll('.pricing-compare.t-acc').forEach((acc) => {
      if (acc._bound) return;
      acc._bound = true;
      const head = acc.querySelector('.t-acc-head');
      if (!head) return;
      head.addEventListener('click', () => {
        const open = acc.getAttribute('data-open') === 'true';
        acc.setAttribute('data-open', String(!open));
        head.setAttribute('aria-expanded', String(!open));
      });
    });
  }

  function boot() {
    initSmoothScroll();
    initProjectPixels();
    initTooltips();
    initContactForm();
    initRecommendations();
    initPricingTabs();
    initPricingCompare();

    const masonry = document.querySelector('#projects .masonry');
    if (masonry) {
      new MutationObserver(() => initProjectPixels()).observe(masonry, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src'],
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.initProjectPixels = initProjectPixels;
  window.portfolioLenis = () => lenis;
  window.animateThemeSwitch = animateThemeSwitch;
})();
