/** Shared project data for Portfolio + Projects-admin pages. */
window.PortfolioProjects = {
  STORAGE_KEY: 'px-portfolio-projects',
  IDB_NAME: 'px-portfolio',
  IDB_STORE: 'project-images',
  ASSETS_REV: '4',

  DEFAULT_PROJECTS: [
    { id: 'p1', title: 'DryTripping Travel', tags: ['Travel Marketplace', 'Custom CMS'], src: 'uploads/dtt.png' },
    { id: 'p2', title: 'Mini Muse', tags: ['Shopify Website', 'Branding'], src: 'uploads/minimuse.png' },
    { id: 'p3', title: 'Opman', tags: ['AI Workflow Automation', 'Design System'], src: 'uploads/opman.png' },
    { id: 'p4', title: 'Jurnii', tags: ['Product Design', 'Design System'], src: 'uploads/jurnii.png' },
    { id: 'p5', title: 'Livegoals', tags: ['Live Score & Betting Tips', 'UI/UX'], src: 'uploads/projects/p5-livegoals.jpg' },
    { id: 'p6', title: 'MJB Jarvis', tags: ['Construction', 'Website & Branding'], src: 'uploads/mjb-jarvis.png' },
    { id: 'p7', title: 'FitEffekt', tags: ['Gym', 'Website & Branding'], src: 'uploads/fit-effekt.png' },
    { id: 'p8', title: 'Surge Fitness', tags: ['Gym', 'Website & Branding'], src: 'uploads/surge.png' },
    { id: 'p9', title: 'Karozza', tags: ['Branding', 'Website Development'], src: 'uploads/karozza.jpg' },
    { id: 'p10', title: 'Food Delivery App', tags: ['UI/UX', 'Mobile App'], src: 'uploads/grubu-mockup.webp' },
    { id: 'p11', title: 'Marketplace UI', tags: ['UI/UX', 'Marketplace'], src: 'uploads/marketplace.webp' },
  ],

  _objectUrls: Object.create(null),

  cloneDefaults() {
    return this.DEFAULT_PROJECTS.map((p) => ({
      id: p.id,
      title: p.title,
      tags: [...(p.tags || [])],
      src: p.src || '',
      rev: undefined,
      imageId: null,
    }));
  },

  isRemoteLegacy(src) {
    return !src || /iamdexter\.com|shortpixel\.ai/.test(src);
  },

  isDataUrl(src) {
    return typeof src === 'string' && /^data:/i.test(src);
  },

  isBlobUrl(src) {
    return typeof src === 'string' && /^blob:/i.test(src);
  },

  normTitle(title) {
    return String(title || '')
      .toLowerCase()
      .replace(/deliery/g, 'delivery')
      .replace(/\s+/g, ' ')
      .trim();
  },

  defaultById() {
    const map = Object.create(null);
    this.DEFAULT_PROJECTS.forEach((p) => { map[p.id] = p; });
    return map;
  },

  readRaw() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  writeRaw(payload) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.warn('PortfolioProjects save failed:', err);
      return false;
    }
  },

  openDb() {
    if (this._db) return Promise.resolve(this._db);
    if (this._dbP) return this._dbP;
    if (!window.indexedDB) return Promise.resolve(null);
    this._dbP = new Promise((resolve) => {
      const req = indexedDB.open(this.IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this.IDB_STORE)) db.createObjectStore(this.IDB_STORE);
      };
      req.onsuccess = () => {
        this._db = req.result;
        resolve(this._db);
      };
      req.onerror = () => resolve(null);
    });
    return this._dbP;
  },

  async putImage(id, src) {
    if (!id || !src || this.isBlobUrl(src)) return;
    const db = await this.openDb();
    if (!db) return;
    let value = src;
    if (this.isDataUrl(src)) {
      const res = await fetch(src);
      value = await res.blob();
    }
    return new Promise((resolve) => {
      const tx = db.transaction(this.IDB_STORE, 'readwrite');
      tx.objectStore(this.IDB_STORE).put(value, id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  },

  async getImage(id) {
    if (!id) return null;
    const db = await this.openDb();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction(this.IDB_STORE, 'readonly');
      const req = tx.objectStore(this.IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  },

  async deleteImage(id) {
    const db = await this.openDb();
    if (!db || !id) return;
    return new Promise((resolve) => {
      const tx = db.transaction(this.IDB_STORE, 'readwrite');
      tx.objectStore(this.IDB_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  },

  objectUrlFor(id, blob) {
    if (this._objectUrls[id]) URL.revokeObjectURL(this._objectUrls[id]);
    const url = URL.createObjectURL(blob);
    this._objectUrls[id] = url;
    return url;
  },

  recordFromLegacy(p) {
    if (!p || !p.id) return null;
    const src = this.isRemoteLegacy(p.src) ? '' : (p.src || '');
    return {
      id: p.id,
      title: p.title || 'New project',
      tags: Array.isArray(p.tags) ? p.tags : [],
      src: this.isDataUrl(src) ? '' : src,
      imageId: this.isDataUrl(src) ? p.id : null,
      rev: p.rev,
      _inlineSrc: this.isDataUrl(src) ? src : '',
    };
  },

  fromV2(raw) {
    const overrides = raw.overrides && typeof raw.overrides === 'object' ? raw.overrides : {};
    const defs = this.DEFAULT_PROJECTS;
    const defById = this.defaultById();
    const defIds = new Set(defs.map((p) => p.id));
    const extras = Object.keys(overrides).filter((id) => !defIds.has(id));
    let order;
    if (Array.isArray(raw.order) && raw.order.length) {
      order = raw.order.filter((id, i, arr) => arr.indexOf(id) === i && (defIds.has(id) || overrides[id]));
      extras.forEach((id) => { if (!order.includes(id)) order.push(id); });
    } else {
      order = defs.map((p) => p.id).concat(extras);
    }
    return order.map((id) => {
      const d = defById[id] || { id, title: 'New project', tags: [], src: '' };
      const o = overrides[id] || {};
      let src = (o.src != null && o.src !== '') ? o.src : (d.src || '');
      if (this.isRemoteLegacy(src) && !this.isDataUrl(src)) src = d.src || '';
      const inline = this.isDataUrl(src);
      return {
        id,
        title: o.title != null ? o.title : d.title,
        tags: Array.isArray(o.tags) ? o.tags : (d.tags || []),
        src: inline ? '' : src,
        imageId: inline ? id : null,
        rev: o.rev,
        _inlineSrc: inline ? src : '',
      };
    });
  },

  fromV3(raw) {
    return (raw.projects || []).map((p) => {
      if (!p || !p.id) return null;
      const src = p.src || '';
      const inline = this.isDataUrl(src);
      return {
        id: p.id,
        title: p.title || 'New project',
        tags: Array.isArray(p.tags) ? p.tags : [],
        src: inline ? '' : src,
        imageId: p.imageId || (inline ? p.id : null),
        rev: p.rev,
        _inlineSrc: inline ? src : '',
      };
    }).filter(Boolean);
  },

  dedupeByTitle(list) {
    const seen = Object.create(null);
    const out = [];
    list.forEach((p) => {
      const key = this.normTitle(p.title);
      if (!key) {
        out.push(p);
        return;
      }
      const prev = seen[key];
      if (!prev) {
        seen[key] = p;
        out.push(p);
        return;
      }
      const prevHasCustom = !!(prev._inlineSrc || prev.imageId || (prev.src && !this.DEFAULT_PROJECTS.some((d) => d.id === prev.id && d.src === prev.src)));
      const nextHasCustom = !!(p._inlineSrc || p.imageId || (p.src && !this.DEFAULT_PROJECTS.some((d) => d.id === p.id && d.src === p.src)));
      if (nextHasCustom && !prevHasCustom) {
        const idx = out.indexOf(prev);
        const merged = {
          ...p,
          title: p.title || prev.title,
          tags: (p.tags && p.tags.length) ? p.tags : prev.tags,
          src: p.src || prev.src,
          imageId: p.imageId || prev.imageId,
          _inlineSrc: p._inlineSrc || prev._inlineSrc,
        };
        out[idx] = merged;
        seen[key] = merged;
      }
    });
    return out;
  },

  hydrate(raw) {
    if (!raw) return this.cloneDefaults();
    let list;
    if (Array.isArray(raw)) {
      list = raw.map((p) => this.recordFromLegacy(p)).filter(Boolean);
    } else if (raw.v === 3 && Array.isArray(raw.projects)) {
      list = this.fromV3(raw);
    } else if (raw.v === 2 || raw.overrides) {
      list = this.fromV2(raw);
    } else if (Array.isArray(raw.projects)) {
      list = this.fromV3(raw);
    } else {
      return this.cloneDefaults();
    }
    if (!list.length) return this.cloneDefaults();
    const titles = new Set(list.map((p) => this.normTitle(p.title)));
    const ids = new Set(list.map((p) => p.id));
    ['p9', 'p10', 'p11'].forEach((id) => {
      const d = this.defaultById()[id];
      if (!d || ids.has(id) || titles.has(this.normTitle(d.title))) return;
      list.push({
        id: d.id,
        title: d.title,
        tags: [...(d.tags || [])],
        src: d.src || '',
        imageId: null,
        rev: undefined,
        _inlineSrc: '',
      });
    });
    return this.dedupeByTitle(list);
  },

  load() {
    return this.hydrate(this.readRaw()).map((p) => ({
      id: p.id,
      title: p.title,
      tags: p.tags || [],
      src: p._inlineSrc || p.src || '',
      imageId: p.imageId || null,
      rev: p.rev,
    }));
  },

  async attachStoredImages(projects) {
    const next = [];
    for (const p of projects) {
      const copy = { ...p };
      if (!copy.src || this.isBlobUrl(copy.src)) {
        const blob = await this.getImage(copy.imageId || copy.id);
        if (blob instanceof Blob) copy.src = this.objectUrlFor(copy.id, blob);
        else if (typeof blob === 'string' && blob) copy.src = blob;
      }
      next.push(copy);
    }
    return next;
  },

  async loadAll() {
    return this.attachStoredImages(this.load());
  },

  toStoredRecord(p) {
    const src = p.src || '';
    const inline = this.isDataUrl(src);
    return {
      id: p.id,
      title: p.title || 'New project',
      tags: Array.isArray(p.tags) ? p.tags : [],
      src: inline || this.isBlobUrl(src) ? '' : src,
      imageId: inline || this.isBlobUrl(src) || p.imageId ? (p.imageId || p.id) : null,
      rev: p.rev || undefined,
    };
  },

  async save(projects) {
    for (const p of projects) {
      if (this.isDataUrl(p.src)) {
        await this.putImage(p.id, p.src);
        p.imageId = p.id;
      }
    }
    const payload = {
      v: 3,
      updatedAt: Date.now(),
      projects: projects.map((p) => this.toStoredRecord(p)),
    };
    let ok = this.writeRaw(payload);
    if (!ok) {
      payload.projects.forEach((r) => { r.src = r.src && this.isDataUrl(r.src) ? '' : r.src; });
      ok = this.writeRaw(payload);
    }
    return ok;
  },

  async resetToDefaults() {
    const db = await this.openDb();
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(this.IDB_STORE, 'readwrite');
        tx.objectStore(this.IDB_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
    Object.keys(this._objectUrls).forEach((id) => URL.revokeObjectURL(this._objectUrls[id]));
    this._objectUrls = Object.create(null);
    return this.writeRaw({
      v: 3,
      updatedAt: Date.now(),
      projects: this.cloneDefaults().map((p) => this.toStoredRecord(p)),
    });
  },

  displaySrc(project) {
    const src = (project && project.src) || '';
    if (!src || /^data:/i.test(src) || /^blob:/i.test(src)) return src;
    const bust = project.rev || this.ASSETS_REV;
    return src + (src.includes('?') ? '&' : '?') + 'v=' + bust;
  },
};
