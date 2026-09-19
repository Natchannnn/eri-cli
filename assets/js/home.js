(() => {
  'use strict';

  const isStatic = matchMedia('(max-width: 820px)').matches;

  window.stopFallbackTerrain = () => {};
  window.startFallbackTerrain = () => {};

  function initFallbackCanvas() {
    const canvas = document.querySelector('#terrain');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const points = [0, .07, .13, .19, .27, .34, .41, .49, .57, .64, .72, .79, .86, .93, 1];
    const heights = [.18, .28, .22, .48, .34, .63, .39, .82, .43, .70, .36, .56, .25, .43, .31];
    let running = false;
    let frameId = 0;
    let dpr = 1;
    let width = 0;
    let height = 0;
    let easedScroll = scrollY;
    let targetScroll = scrollY;
    let pointerX = .5;
    let pointerForce = 0;

    const mix = (a, b, t) => a + (b - a) * t;
    const ease = value => value * value * (3 - 2 * value);

    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      width = innerWidth;
      height = innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function terrainPoints(state) {
      return points.map((x, index) => {
        const local = Math.max(0, 1 - Math.abs(x - pointerX) * 7) * pointerForce;
        const floorY = height - heights[index] * height * .43 - local * 42;
        const ceilingY = heights[index] * height * .34 + local * 34;
        if (state <= 1) return [x * width, mix(floorY, ceilingY, ease(state))];
        const t = ease(state - 1);
        const specimenX = width * (.43 + x * .57);
        const specimenY = height * (.05 + heights[index] * .31) + local * 18;
        return [mix(x * width, specimenX, t), mix(ceilingY, specimenY, t)];
      });
    }

    function renderFrame() {
      easedScroll += (targetScroll - easedScroll) * .085;
      pointerForce *= .94;
      const state = Math.max(0, Math.min(2, easedScroll / Math.max(height, 1)));
      const terrain = terrainPoints(state);
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      terrain.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      if (state < .5) {
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
      } else {
        ctx.lineTo(terrain[terrain.length - 1][0], 0);
        ctx.lineTo(terrain[0][0], 0);
      }
      ctx.closePath();
      const isLight = document.documentElement.dataset.theme === 'light';
      ctx.fillStyle = isLight ? '#dfe2e6' : '#0a0b0e';
      ctx.fill();
      ctx.beginPath();
      terrain.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.strokeStyle = isLight ? '#08090C' : '#E5E7EB';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.save();
      ctx.globalAlpha = .25;
      ctx.setLineDash([2, 8]);
      [2, 5, 7, 10, 13].forEach(index => {
        const [x, y] = terrain[index];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, state < .5 ? height : 0);
        ctx.stroke();
      });
      ctx.restore();
    }

    function draw() {
      if (!running) return;
      renderFrame();
      frameId = requestAnimationFrame(draw);
    }

    window.stopFallbackTerrain = () => {
      running = false;
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    window.startFallbackTerrain = () => {
      canvas.hidden = false;
      resize();
      if (isStatic) {
        renderFrame();
      } else {
        if (!running) {
          running = true;
          frameId = requestAnimationFrame(draw);
        }
      }
    };

    addEventListener('resize', () => {
      resize();
      if (isStatic || !running) renderFrame();
    });
    addEventListener('scroll', () => {
      targetScroll = scrollY;
      if (isStatic || !running) renderFrame();
    }, { passive: true });
    addEventListener('pointermove', event => {
      pointerX = event.clientX / Math.max(width, 1);
      pointerForce = .7;
    }, { passive: true });

    const isPendingCurtain = document.documentElement.classList.contains('curtain-pending');
    if (isStatic || isPendingCurtain) {
      canvas.hidden = true;
    } else {
      resize();
      running = true;
      frameId = requestAnimationFrame(draw);
    }
  }

  try {
    initFallbackCanvas();
  } catch (err) {
    console.warn('Canvas fallback initialization skipped:', err);
  }

  const projectData = [
    {
      status: 'In use',
      title: 'HomeLab',
      copy: 'A self-hosted network and server stack used by 29 friends and family, running UniFi routing, Proxmox virtualization, Docker containers, and automated storage.',
      facts: [['Use', '23 regular users'], ['Built with', 'UniFi / Proxmox / Docker'], ['Runs', 'Self-hosted, 24/7']]
    },
    {
      status: 'Released',
      title: 'Disclaude Sesh',
      copy: 'An open-source Discord bridge for starting, driving and supervising Claude Code sessions on a headless server from a phone, with documentation and versioned releases.',
      facts: [['Access', 'Discord / phone'], ['Built with', 'TypeScript / Bun / systemd'], ['Evidence', 'Open source release']]
    },
    {
      status: 'Released',
      title: 'Usage Meter',
      copy: 'A fork of an open-source Stream Deck plugin that reports Claude usage limits and local token and cost totals, extended with dial support, a vendored dependency and a release gate.',
      facts: [['Device', 'Stream Deck and Stream Deck+'], ['Built with', 'TypeScript / Node.js'], ['Change', 'Dial support / release gate']]
    }
  ];

  const projectButtons = [...document.querySelectorAll('.project-list [data-project]')];
  const factLabels = ['fact-label-one', 'fact-label-two', 'fact-label-three'];
  const factValues = ['fact-one', 'fact-two', 'fact-three'];
  function selectProject(index) {
    const project = projectData[index];
    projectButtons.forEach((btn, btnIndex) => {
      btn.setAttribute('aria-pressed', String(btnIndex === index));
    });
    document.querySelector('#project-status').textContent = project.status;
    document.querySelector('#selected-project-title').textContent = project.title;
    document.querySelector('#project-copy').textContent = project.copy;
    project.facts.forEach((fact, factIndex) => {
      document.getElementById(factLabels[factIndex]).textContent = fact[0];
      document.getElementById(factValues[factIndex]).textContent = fact[1];
    });
  }
  projectButtons.forEach((btn, index) => {
    btn.addEventListener('pointerenter', () => selectProject(index));
    btn.addEventListener('focus', () => selectProject(index));
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      selectProject(index);
    });
  });

  if (typeof window.initSnapScroller === 'function') {
    window.initSnapScroller('main > .page');
  }

  let threeLoaded = false;
  function loadThreeScripts() {
    if (threeLoaded) return;
    threeLoaded = true;

    const onScriptError = () => {
      clearTimeout(window.__faultlineCurtainFallback);
      document.documentElement.classList.remove('curtain-pending', 'curtain-running');
      if (typeof window.startFallbackTerrain === 'function') {
        window.startFallbackTerrain();
      }
    };

    const s1 = document.createElement('script');
    s1.src = "./assets/js/three.min.js";
    s1.async = false;
    s1.onerror = onScriptError;

    const s2 = document.createElement('script');
    s2.src = "./assets/js/terrain.js";
    s2.async = false;
    s2.onerror = onScriptError;

    document.head.append(s1, s2);
  }

  const mql = window.matchMedia('(max-width: 820px)');
  if (!mql.matches) {
    loadThreeScripts();
  }

  mql.addEventListener('change', (e) => {
    if (!e.matches) {
      if (!threeLoaded) {
        loadThreeScripts();
      } else if (typeof window.resumeTerrain === 'function') {
        window.resumeTerrain();
      }
    } else {
      if (typeof window.pauseTerrain === 'function') {
        window.pauseTerrain();
      }
    }
  });
})();
