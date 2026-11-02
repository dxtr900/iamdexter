/** Shared project data for Portfolio + Projects-admin pages. */
window.PortfolioProjects = {
  STORAGE_KEY: 'px-portfolio-projects',
  /** Bump when default image paths change so old localStorage snapshots cannot pin stale srcs. */
  DEFAULTS_REVISION: 3,
  /** Cache-bust query for file replacements at the same path. */
  ASSETS_REV: '3',

  LOCAL_SRC: {
    p1: 'uploads/projects/p1-drytripping.jpg',
    p2: 'uploads/projects/p2-minimuse.png',
    p3: 'uploads/projects/p3-opman.jpg',
    p4: 'uploads/projects/p4-jurnii.jpg',
    p5: 'uploads/projects/p5-livegoals.jpg',
    p6: 'uploads/projects/p6-mjb-jarvis.jpg',
    p7: 'uploads/projects/p7-fiteffekt.jpg',
    p8: 'uploads/projects/p8-surge-fitness.png',
  },

  DEFAULT_PROJECTS: [
    { id: 'p1', title: 'DryTripping Travel', tags: ['Travel Marketplace', 'Custom CMS'], src: 'uploads/dtt.png' },
    { id: 'p2', title: 'Mini Muse', tags: ['Shopify Website', 'Branding'], src: 'uploads/minimuse.png' },
    { id: 'p3', title: 'Opman', tags: ['AI Workflow Automation', 'Design System'], src: 'uploads/opman.png' },
    { id: 'p4', title: 'Jurnii', tags: ['Product Design', 'Design System'], src: 'uploads/jurnii.png' },
    { id: 'p5', title: 'Livegoals', tags: ['Live Score & Betting Tips', 'UI/UX'], src: 'uploads/projects/p5-livegoals.jpg' },
    { id: 'p6', title: 'MJB Jarvis', tags: ['Construction', 'Website & Branding'], src: 'uploads/mjb-jarvis.png' },
    { id: 'p7', title: 'FitEffekt', tags: ['Gym', 'Website & Branding'], src: 'uploads/fit-effekt.png' },
    { id: 'p8', title: 'Surge Fitness', tags: ['Gym', 'Website & Branding'], src: 'uploads/surge.png' },
  ],

  isRemoteLegacy(src) {
    return !src || /iamdexter\.com|shortpixel\.ai/.test(src);
  },

  defaultById() {
    const map = Object.create(null);
    this.DEFAULT_PROJECTS.forEach((p) => { map[p.id] = p; });
    return map;
  },

  isStaleBundledSrc(id, src) {
    if (this.isRemoteLegacy(src)) return true;
    const def = this.defaultById()[id];
    if (def && src === def.src) return true;
    if (this.LOCAL_SRC[id] && src === this.LOCAL_SRC[id]) return true;
    return false;
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
    } catch {
      return false;
    }
  },

  /** Convert a v1 full-array snapshot into field overrides. */
  overridesFromLegacyArray(list) {
    const defs = this.defaultById();
    const overrides = Object.create(null);
    (list || []).forEach((p) => {
      if (!p || !p.id) return;
      const d = defs[p.id];
      const o = {};
      if (!d) {
        overrides[p.id] = {
          title: p.title || 'New project',
          tags: Array.isArray(p.tags) ? p.tags : [],
          src: p.src || '',
          srcPinned: true,
          rev: p.rev,
        };
        return;
      }
      if (p.title && p.title !== d.title) o.title = p.title;
      const tags = Array.isArray(p.tags) ? p.tags : [];
      if (JSON.stringify(tags) !== JSON.stringify(d.tags || [])) o.tags = tags;
      if (p.src && !this.isStaleBundledSrc(p.id, p.src) && p.src !== d.src) {
        o.src = p.src;
        o.srcPinned = true;
      }
      if (p.rev) o.rev = p.rev;
      if (Object.keys(o).length) overrides[p.id] = o;
    });
    return {
      v: 2,
      defaultsRevision: this.DEFAULTS_REVISION,
      order: list.map((p) => p.id).filter(Boolean),
      overrides,
    };
  },

  normalizeStored(raw) {
    if (!raw) {
      return { v: 2, defaultsRevision: this.DEFAULTS_REVISION, overrides: {} };
    }
    if (Array.isArray(raw)) return this.overridesFromLegacyArray(raw);
    if (raw.v !== 2 || !raw.overrides || typeof raw.overrides !== 'object') {
      if (Array.isArray(raw.projects)) return this.overridesFromLegacyArray(raw.projects);
      return { v: 2, defaultsRevision: this.DEFAULTS_REVISION, overrides: {} };
    }

    const overrides = { ...raw.overrides };
    const staleDefaults = (raw.defaultsRevision || 0) < this.DEFAULTS_REVISION;
    if (staleDefaults) {
      Object.keys(overrides).forEach((id) => {
        const o = overrides[id];
        if (!o) return;
        if (!o.srcPinned || this.isStaleBundledSrc(id, o.src)) {
          delete o.src;
          delete o.srcPinned;
        }
        if (!Object.keys(o).length) delete overrides[id];
        else overrides[id] = o;
      });
    }

    return {
      v: 2,
      defaultsRevision: this.DEFAULTS_REVISION,
      order: Array.isArray(raw.order) ? raw.order : undefined,
      overrides,
    };
  },

  merge(payload) {
    const overrides = payload.overrides || {};
    const defs = this.DEFAULT_PROJECTS;
    const defIds = new Set(defs.map((p) => p.id));
    const extras = Object.keys(overrides).filter((id) => !defIds.has(id));
    const defaultOrder = defs.map((p) => p.id);
    const order = (payload.order && payload.order.length)
      ? payload.order.filter((id, i, arr) => arr.indexOf(id) === i && (defIds.has(id) || overrides[id]))
      : defaultOrder.concat(extras);
    extras.forEach((id) => { if (!order.includes(id)) order.push(id); });
    defaultOrder.forEach((id) => { if (!order.includes(id)) order.push(id); });

    const defById = this.defaultById();
    return order.map((id) => {
      const d = defById[id] || { id, title: 'New project', tags: [], src: '' };
      const o = overrides[id] || {};
      let src = o.srcPinned ? o.src : (d.src || '');
      if (this.isRemoteLegacy(src)) src = d.src || '';
      return {
        id,
        title: o.title != null ? o.title : d.title,
        tags: Array.isArray(o.tags) ? o.tags : (d.tags || []),
        src,
        rev: o.rev,
        srcPinned: !!o.srcPinned,
      };
    });
  },

  diffOverrides(projects) {
    const defById = this.defaultById();
    const defaultOrder = this.DEFAULT_PROJECTS.map((p) => p.id);
    const order = projects.map((p) => p.id);
    const overrides = Object.create(null);

    projects.forEach((p) => {
      const d = defById[p.id];
      if (!d) {
        overrides[p.id] = {
          title: p.title || 'New project',
          tags: p.tags || [],
          src: p.src || '',
          srcPinned: true,
          rev: p.rev,
        };
        return;
      }
      const o = {};
      if (p.title !== d.title) o.title = p.title;
      if (JSON.stringify(p.tags || []) !== JSON.stringify(d.tags || [])) o.tags = p.tags || [];
      if ((p.src || '') !== (d.src || '')) {
        o.src = p.src || '';
        o.srcPinned = true;
      }
      if (p.rev) o.rev = p.rev;
      if (Object.keys(o).length) overrides[p.id] = o;
    });

    const payload = {
      v: 2,
      defaultsRevision: this.DEFAULTS_REVISION,
      updatedAt: Date.now(),
      overrides,
    };
    if (order.join() !== defaultOrder.join()) payload.order = order;
    return payload;
  },

  purgeStaleImageSlots() {
    try {
      const raw = localStorage.getItem('px-image-slots-state');
      if (!raw) return;
      const o = JSON.parse(raw);
      let n = 0;
      Object.keys(o).forEach((k) => {
        if (k.indexOf('proj-img-') === 0) { delete o[k]; n++; }
      });
      if (n) localStorage.setItem('px-image-slots-state', JSON.stringify(o));
    } catch (_) { /* ignore */ }
  },

  load() {
    this.purgeStaleImageSlots();
    const payload = this.normalizeStored(this.readRaw());
    this.writeRaw(payload);
    return this.merge(payload);
  },

  save(projects) {
    return this.writeRaw(this.diffOverrides(projects));
  },

  resetToDefaults() {
    return this.writeRaw({
      v: 2,
      defaultsRevision: this.DEFAULTS_REVISION,
      updatedAt: Date.now(),
      overrides: {},
    });
  },

  /** URL the thumbnail should actually request. Always cache-busts so replaced files show. */
  displaySrc(project) {
    const src = (project && project.src) || '';
    if (!src || /^data:/i.test(src)) return src;
    const bust = project.rev || this.ASSETS_REV;
    return src + (src.includes('?') ? '&' : '?') + 'v=' + bust;
  },
};
