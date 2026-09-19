(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const noise = (row, column, salt = 0) => {
    const value = Math.sin((row + 1) * 91.17 + (column + 1) * 47.31 + salt * 13.7) * 43758.5453;
    return value - Math.floor(value);
  };

  class ProceduralLattice {
    constructor(host) {
      this.host = host;
      this.variant = host.dataset.lattice;
      this.columns = [];
      this.frame = 0;
      this.lastTime = 0;
      this.assembled = this.variant !== 'about';
      this.svg = document.createElementNS(NS, 'svg');
      this.svg.setAttribute('viewBox', '0 0 1000 760');
      this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      this.svg.setAttribute('aria-hidden', 'true');
      this.svg.setAttribute('focusable', 'false');
      this.svg.classList.add('lattice-svg');
      this.host.append(this.svg);
      if (this.variant === 'reader') this.host.closest('.reader-cut')?.classList.add('is-rendered');
      this.build();
      this.bind();
    }

    makePolygon(className) {
      const polygon = document.createElementNS(NS, 'polygon');
      polygon.setAttribute('class', className);
      polygon.setAttribute('vector-effect', 'non-scaling-stroke');
      return polygon;
    }

    baseHeight(row, column) {
      const grain = noise(row, column, this.variant.length);
      if (this.variant === 'projects') {
        return 5 + grain * 22 + Math.max(0, 2 - Math.abs(row - 5)) * 5;
      }
      if (this.variant === 'blog') {
        const distance = Math.abs(column - 5);
        return distance < 2 ? 17 + grain * 40 : distance < 3 ? 6 + grain * 16 : 2;
      }
      if (this.variant === 'reader') {
        const ridge = Math.max(0, 2.8 - Math.abs(row - 6 - Math.sin(column * .82) * .85));
        return 3 + ridge * ridge * (5.2 + grain * 3.8);
      }
      return 3 + grain * 5;
    }

    build() {
      const fragment = document.createDocumentFragment();
      const rows = 13;
      const columns = 11;
      const stepX = 78;
      const stepY = 48;

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const x = 72 + column * stepX + (row % 2 ? stepX / 2 : 0);
          const y = 78 + row * stepY;
          const group = document.createElementNS(NS, 'g');
          group.setAttribute('class', 'iso-column');
          const left = this.makePolygon('pillar-face pillar-left');
          const right = this.makePolygon('pillar-face pillar-right');
          const cap = this.makePolygon('pillar-cap');
          group.append(left, right, cap);
          fragment.append(group);

          const base = this.baseHeight(row, column);
          this.columns.push({
            row,
            column,
            x,
            y,
            group,
            left,
            right,
            cap,
            base,
            current: reduceMotion ? base : Math.min(base, 2),
            target: base,
            velocity: 0
          });
        }
      }

      this.svg.append(fragment);
      this.columns.forEach((column) => this.renderColumn(column));
      if (!reduceMotion && this.variant !== 'about') this.start();
    }

    renderColumn(column) {
      const halfWidth = 31;
      const halfDepth = 16;
      const height = clamp(column.current, 0, 230);
      const { x, y } = column;
      const capY = y - height;
      column.cap.setAttribute('points', `${x},${capY - halfDepth} ${x + halfWidth},${capY} ${x},${capY + halfDepth} ${x - halfWidth},${capY}`);
      column.left.setAttribute('points', `${x - halfWidth},${capY} ${x},${capY + halfDepth} ${x},${y + halfDepth} ${x - halfWidth},${y}`);
      column.right.setAttribute('points', `${x + halfWidth},${capY} ${x},${capY + halfDepth} ${x},${y + halfDepth} ${x + halfWidth},${y}`);
      const strength = clamp((height - 2) / 130, 0, 1);
      const colDist = Math.abs(column.column - 5) / 5.5;
      const rowDist = Math.abs(column.row - 6) / 6.5;
      let outerFade = 1;
      if (this.variant === 'blog') {
        outerFade = clamp(1 - colDist, .06, 1);
      } else if (this.variant === 'reader' || this.variant === 'about') {
        const edgeX = clamp(1 - colDist, .04, 1);
        const edgeY = clamp(1 - rowDist, .05, 1);
        outerFade = edgeX * edgeY;
      }
      column.group.style.setProperty('--height-strength', strength.toFixed(3));
      column.group.style.opacity = (outerFade * (.2 + strength * .8)).toFixed(3);
    }

    setTargets(mapper, instant = false) {
      this.columns.forEach((column) => {
        column.target = clamp(mapper(column), 0, 230);
        if (instant || reduceMotion) {
          column.current = column.target;
          column.velocity = 0;
          this.renderColumn(column);
        }
      });
      if (!instant && !reduceMotion) this.start();
    }

    rest() {
      if (this.variant === 'about' && this.assembled) {
        this.assemble();
        return;
      }
      this.setTargets((column) => column.base);
    }

    focus(index) {
      const projectCenters = [[2, 2], [3, 7], [6, 4], [8, 8], [10, 2], [11, 7]];
      if (this.variant === 'projects') {
        const [centerRow, centerColumn] = projectCenters[index % projectCenters.length];
        this.setTargets((column) => {
          const distance = Math.hypot((column.row - centerRow) * .86, column.column - centerColumn);
          const lift = Math.max(0, 4.2 - distance);
          return column.base * .68 + lift * lift * (7.5 + noise(column.row, column.column, index) * 5);
        });
      }

      if (this.variant === 'blog') {
        const centerRow = index % 13;
        this.setTargets((column) => {
          const distance = Math.hypot((column.row - centerRow) * .8, (column.column - 5) * 1.35);
          const lift = Math.max(0, 3.2 - distance);
          return column.base * .55 + lift * lift * 10;
        });
      }
    }

    assemble() {
      this.assembled = true;
      this.setTargets((column) => {
        const diagonal = Math.abs((column.column - 5) - (column.row - 6) * .34);
        const tier = Math.max(0, 4.6 - diagonal);
        const breakLine = column.row > 7 ? .7 : 1;
        return 4 + tier * tier * (5.8 + noise(column.row, column.column, 9) * 3.5) * breakLine;
      });
    }

    start() {
      if (this.frame) return;
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }

    tick(time) {
      const factor = clamp((time - this.lastTime) / 16.667, .45, 2);
      this.lastTime = time;
      let moving = false;

      this.columns.forEach((column) => {
        const delta = column.target - column.current;
        column.velocity = (column.velocity + delta * .105 * factor) * Math.pow(.72, factor);
        column.current += column.velocity * factor;
        if (Math.abs(delta) < .08 && Math.abs(column.velocity) < .06) {
          column.current = column.target;
          column.velocity = 0;
        } else {
          moving = true;
        }
        this.renderColumn(column);
      });

      if (moving) {
        this.frame = requestAnimationFrame((nextTime) => this.tick(nextTime));
      } else {
        this.frame = 0;
      }
    }

    bind() {
      const scope = this.host.closest('main') || document;
      const targets = scope.querySelectorAll('[data-lattice-target]');
      targets.forEach((target) => {
        const index = Number(target.dataset.latticeTarget || 0);
        target.addEventListener('pointerenter', () => this.focus(index));
        target.addEventListener('pointerleave', () => this.rest());
        target.addEventListener('focusin', () => this.focus(index));
        target.addEventListener('focusout', () => this.rest());
      });

      if (this.variant === 'about') {
        if (reduceMotion || !('IntersectionObserver' in window)) {
          this.assemble();
        } else {
          const observer = new IntersectionObserver((entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            this.assemble();
            observer.disconnect();
          }, { threshold: .32 });
          observer.observe(this.host);
        }
      }
    }
  }

  document.querySelectorAll('[data-lattice]').forEach((host) => new ProceduralLattice(host));

  const filters = [...document.querySelectorAll('[data-filter]')];
  const searchInput = document.querySelector('[data-blog-search]');
  const clearSearch = document.querySelector('[data-clear-search]');
  const resetFilters = document.querySelector('[data-reset-filters]');
  const posts = [...document.querySelectorAll('[data-post-category]')];
  const months = [...document.querySelectorAll('[data-archive-month]')];
  const monthLinks = [...document.querySelectorAll('[data-month-link]')];
  const statusAnnouncer = document.querySelector('[data-filter-status]');
  const emptyNotice = document.querySelector('[data-empty-notice]');

  if (searchInput && filters.length && posts.length) {
    const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const searchText = new Map(posts.map((post) => [post, normalize(post.querySelector('.post-copy')?.textContent || '')]));
    const categoryKeys = new Set(filters.map((filter) => filter.dataset.filter));
    let category = 'all';

    const applyFilters = (updateUrl = true) => {
      const query = normalize(searchInput.value);
      const terms = query.split(/\s+/).filter(Boolean);
      let visibleCount = 0;
      const visibleMonths = new Set();

      posts.forEach((post) => {
        const categoryMatches = category === 'all' || post.dataset.postCategory === category;
        const titleOrSummary = searchText.get(post);
        const matches = categoryMatches && terms.every((term) => titleOrSummary.includes(term));
        post.hidden = !matches;
        if (matches) {
          visibleCount += 1;
          visibleMonths.add(post.dataset.postMonth);
        }
      });
      months.forEach((month) => { month.hidden = !visibleMonths.has(month.dataset.archiveMonth); });
      monthLinks.forEach((link) => { link.hidden = !visibleMonths.has(link.dataset.monthLink); });
      filters.forEach((filter) => filter.setAttribute('aria-pressed', String(filter.dataset.filter === category)));
      if (clearSearch) clearSearch.hidden = searchInput.value.length === 0;
      if (emptyNotice) emptyNotice.hidden = visibleCount > 0;
      if (statusAnnouncer) {
        statusAnnouncer.textContent = visibleCount === 0
          ? 'No posts match this search.'
          : query || category !== 'all'
            ? `Showing ${visibleCount} of ${posts.length} posts`
            : `Showing all ${posts.length} posts`;
      }

      if (updateUrl) {
        const url = new URL(location.href);
        if (searchInput.value.trim()) url.searchParams.set('q', searchInput.value.trim());
        else url.searchParams.delete('q');
        if (category !== 'all') url.searchParams.set('category', category);
        else url.searchParams.delete('category');
        if (url.hash && !visibleMonths.has(url.hash.replace('#month-', ''))) url.hash = '';
        history.replaceState(null, '', url);
      }
    };

    const restoreFromUrl = () => {
      const params = new URLSearchParams(location.search);
      const requested = params.get('category') || 'all';
      category = categoryKeys.has(requested) ? requested : 'all';
      searchInput.value = params.get('q') || '';
      applyFilters(false);
    };

    filters.forEach((filter) => {
      filter.addEventListener('click', () => { category = filter.dataset.filter; applyFilters(); });
    });
    searchInput.addEventListener('input', () => applyFilters());
    if (clearSearch) clearSearch.addEventListener('click', () => { searchInput.value = ''; applyFilters(); searchInput.focus(); });
    if (resetFilters) resetFilters.addEventListener('click', () => { category = 'all'; searchInput.value = ''; applyFilters(); searchInput.focus(); });
    window.addEventListener('popstate', restoreFromUrl);
    restoreFromUrl();
  }

  // Snappy full-slide scroll handler for multi-page layouts (about.html)
  if (typeof window.initSnapScroller === 'function') {
    window.initSnapScroller('main > .about-snap-page');
  }

  // Theme Toggle Controller
  function initThemeToggle() {
    const btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    const sync = () => {
      const isLight = document.documentElement.dataset.theme === 'light';
      btn.textContent = isLight ? 'DARK' : 'LIGHT';
      btn.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
    };
    sync();
    btn.addEventListener('click', () => {
      const isLight = document.documentElement.dataset.theme === 'light';
      if (isLight) {
        delete document.documentElement.dataset.theme;
        try { localStorage.setItem('eri-theme', 'dark'); } catch (_) {}
      } else {
        document.documentElement.dataset.theme = 'light';
        try { localStorage.setItem('eri-theme', 'light'); } catch (_) {}
      }
      sync();
    });
  }
  initThemeToggle();
})();
