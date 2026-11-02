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
      if (!this.wrap) return;
      this.wrap.style.opacity = '1';
      this.tile.classList.add('pixel-active');
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
            this.reveal();
            this.animatePixels();
            this.observer?.disconnect();
          });
        },
        { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
      );
      this.observer.observe(this.tile);
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

  function boot() {
    initSmoothScroll();
    initProjectPixels();
    initTooltips();
    initContactForm();

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
