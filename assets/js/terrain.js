(function () {
  'use strict';

  const fallback = document.querySelector('#terrain');
  const stage = document.querySelector('#terrain-stage');
  const canvas = document.querySelector('#terrain-webgl');
  const overlay = document.querySelector('#terrain-overlay');
  let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mobile = matchMedia('(max-width: 820px)').matches;
  const curtainEligible = document.documentElement.classList.contains('curtain-pending');
  if (!window.THREE || !fallback || !stage || !canvas) return;

  const config = {
    palette: {
      black: 0x08090c,
      mass: 0x0a0b0e,
      signal: 0xe5e7eb,
      accent: 0x002fa7,
      slate: 0x4b5565
    },
    columns: mobile ? 38 : 52,
    rows: mobile ? 12 : 20,
    blockSize: 1.33,
    gap: 0.14,
    cameraSize: mobile ? 21 : 18.2,
    yaw: 43,
    pitch: 39,
    baseHeight: 0.16,
    peakHeight: 10.5,
    peakWidth: 0.165,
    ridgeCenter: 0.35,
    ridgeDepth: 0.30,
    frontFloor: 0.26,
    relief: 0.85,
    drift: reduced ? 0 : 0.47,
    driftSpeed: 0.82,
    hoverRadius: 5.4,
    hoverLift: 6.9,
    shockStrength: 3.8,
    shockWidth: 4.5,
    shockSpeed: 11.8,
    shockDecay: 0.18,
    meshOpacity: 0.43,
    capOpacity: 0.40,
    pillarOpacity: 0.33,
    lineWidth: 0.50,
    surfaceOffset: 35,
    ceilingOffset: -32
  };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile,
      alpha: true,
      powerPreference: 'high-performance'
    });
  } catch (_) { return; }

  fallback.hidden = true;
  stage.hidden = false;
  if (overlay) overlay.hidden = true;
  if (typeof window.stopFallbackTerrain === 'function') window.stopFallbackTerrain();

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smooth = value => value * value * (3 - 2 * value);
  const mix = (a, b, t) => a + (b - a) * t;
  const damp = (from, to, rate, dt) => from + (to - from) * (1 - Math.exp(-rate * dt));
  const tri = (value, center, radius) => Math.max(0, 1 - Math.abs(value - center) / radius);
  const gaussian = (value, center, radius) => Math.exp(-Math.pow((value - center) / radius, 2));
  const hash = (x, y) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
    return value - Math.floor(value);
  };

  function mulberry32(seed) {
    return function () {
      let value = seed += 0x6D2B79F5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  let seed;
  try {
    seed = Number(sessionStorage.getItem('faultline-v7-seed'));
    if (!seed) {
      seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      sessionStorage.setItem('faultline-v7-seed', String(seed));
    }
  } catch (_) { seed = 173205; }

  function generateRawPeaks(nextSeed) {
    const random = mulberry32(nextSeed);
    const roll = random();
    const count = roll < 0.15 ? 1 : roll < 0.50 ? 2 : roll < 0.84 ? 3 : 4;

    const pBands = count === 1
      ? [0.98 + random() * 0.05]
      : count === 2
      ? [1.00 + random() * 0.04, 0.72 + random() * 0.08]
      : count === 3
      ? [1.00 + random() * 0.04, 0.72 + random() * 0.08, 0.54 + random() * 0.08]
      : [1.00 + random() * 0.04, 0.74 + random() * 0.07, 0.57 + random() * 0.07, 0.44 + random() * 0.06];

    const minSepX = count >= 4 ? 0.12 : count === 3 ? 0.15 : 0.20;
    const minSep2D = count >= 4 ? 0.16 : count === 3 ? 0.19 : 0.24;
    const peaks = [];
    let attempts = 0;

    while (peaks.length < count && attempts++ < 200) {
      const candX = 0.18 + random() * 0.64;
      const candY = 0.20 + random() * 0.32;
      const ok = peaks.every(p => {
        const dx = Math.abs(p.x - candX);
        const dy = Math.abs(p.depth - candY);
        const dist2D = Math.hypot(dx, dy * 0.8);
        return dx >= minSepX && dist2D >= minSep2D;
      });
      if (ok) {
        peaks.push({ x: candX, depth: candY });
      }
    }

    while (peaks.length < count) {
      peaks.push({
        x: 0.20 + (peaks.length / count) * 0.60,
        depth: 0.24 + ((peaks.length % 2) * 0.16)
      });
    }

    peaks.sort((a, b) => a.x - b.x);

    // Randomize which position gets the standout hero peak
    const standoutIdx = Math.floor(random() * count);
    const finalProminences = new Array(count);
    finalProminences[standoutIdx] = pBands[0];
    let pIdx = 1;
    for (let i = 0; i < count; i++) {
      if (i !== standoutIdx) {
        finalProminences[i] = pBands[pIdx++];
      }
    }

    return peaks.map((p, i) => ({
      x: p.x,
      width: config.peakWidth * (0.90 + random() * 0.22),
      prominence: finalProminences[i],
      depth: p.depth
    }));
  }

  function createInitialFaults(nextSeed) {
    const raw = generateRawPeaks(nextSeed);
    return Array.from({ length: 4 }, (_, index) => {
      const peak = raw[index];
      return peak
        ? new THREE.Vector4(peak.x, peak.width, peak.prominence, peak.depth)
        : new THREE.Vector4(0.5, config.peakWidth, 0, config.ridgeCenter);
    });
  }

  function planFaultTransition(currentFrom, nextSeed) {
    const newPeaks = generateRawPeaks(nextSeed);
    const toSlots = [];
    const updatedFrom = currentFrom.map(s => s.clone());
    const K = newPeaks.length;

    for (let i = 0; i < 4; i++) {
      if (i < K) {
        const np = newPeaks[i];
        if (updatedFrom[i].z <= 0.001) {
          // Emerging peak: starts from height 0 at target location (tectonic uplift)
          updatedFrom[i].set(np.x, np.width, 0.0, np.depth);
        }
        toSlots.push(new THREE.Vector4(np.x, np.width, np.prominence, np.depth));
      } else {
        // Subside in place if was previously active
        if (updatedFrom[i].z > 0.001) {
          toSlots.push(new THREE.Vector4(updatedFrom[i].x, updatedFrom[i].y, 0.0, updatedFrom[i].w));
        } else {
          toSlots.push(new THREE.Vector4(0.5, config.peakWidth, 0.0, config.ridgeCenter));
        }
      }
    }
    return { updatedFrom, toSlots };
  }

  const initialFaults = createInitialFaults(seed);
  const fault = {
    from: initialFaults.map(v => v.clone()),
    to: initialFaults.map(v => v.clone()),
    blend: 0,
    blending: false,
    blendStart: 0,
    blendDuration: 3000,
    nextAt: performance.now() + 5000 + (seed % 3000)
  };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200);
  const baseGeometry = new THREE.BoxGeometry(1, 1, 1);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.index = baseGeometry.index;
  Object.keys(baseGeometry.attributes).forEach(name => {
    geometry.setAttribute(name, baseGeometry.attributes[name]);
  });

  const max = 52 * 20;
  const worldData = new Float32Array(max * 2);
  const fieldData = new Float32Array(max * 2);
  const roughData = new Float32Array(max);
  const phaseData = new Float32Array(max);
  const worldAttribute = new THREE.InstancedBufferAttribute(worldData, 2);
  const fieldAttribute = new THREE.InstancedBufferAttribute(fieldData, 2);
  const roughAttribute = new THREE.InstancedBufferAttribute(roughData, 1);
  const phaseAttribute = new THREE.InstancedBufferAttribute(phaseData, 1);
  geometry.setAttribute('aWorld', worldAttribute);
  geometry.setAttribute('aField', fieldAttribute);
  geometry.setAttribute('aRough', roughAttribute);
  geometry.setAttribute('aPhase', phaseAttribute);

  const fromUniform = fault.from.map(value => value.clone());
  const toUniform = fault.to.map(value => value.clone());
  const shockUniform = Array.from({ length: 3 }, () => new THREE.Vector4(999, 999, 0, 0));
  const uniforms = {
    uTime: { value: 0 },
    uBlock: { value: config.blockSize },
    uBaseHeight: { value: config.baseHeight },
    uPeakHeight: { value: config.peakHeight },
    uHeightLimit: { value: config.peakHeight + 4.5 },
    uRidgeDepth: { value: config.ridgeDepth },
    uFrontFloor: { value: config.frontFloor },
    uDrift: { value: config.drift },
    uDriftSpeed: { value: config.driftSpeed },
    uFaultFrom: { value: fromUniform },
    uFaultTo: { value: toUniform },
    uFaultBlend: { value: 0 },
    uHover: { value: new THREE.Vector4(999, 999, config.hoverRadius, 0) },
    uShock: { value: shockUniform },
    uShockStrength: { value: config.shockStrength },
    uShockWidth: { value: config.shockWidth },
    uTrace: { value: 0 },
    uMassColor: { value: new THREE.Color(config.palette.mass) },
    uSignalColor: { value: new THREE.Color(config.palette.signal) },
    uAccentColor: { value: new THREE.Color(config.palette.accent) },
    uTerrainReveal: { value: 1 },
    uMeshOpacity: { value: config.meshOpacity },
    uCapOpacity: { value: config.capOpacity },
    uPillarOpacity: { value: config.pillarOpacity },
    uLineWidth: { value: 0.006 + config.lineWidth * 0.009 }
  };

  const heightShader = `
      precision highp float;
      attribute vec2 aWorld;
      attribute vec2 aField;
      attribute float aRough;
      attribute float aPhase;
      uniform float uTime;
      uniform float uBlock;
      uniform float uBaseHeight;
      uniform float uPeakHeight;
      uniform float uHeightLimit;
      uniform float uRidgeDepth;
      uniform float uFrontFloor;
      uniform float uDrift;
      uniform float uDriftSpeed;
      uniform vec4 uFaultFrom[4];
      uniform vec4 uFaultTo[4];
      uniform float uFaultBlend;
      uniform vec4 uHover;
      uniform vec4 uShock[3];
      uniform float uShockStrength;
      uniform float uShockWidth;
      uniform float uTrace;
      varying float vHeight;
      varying float vPresence;

      void computeFaultHeight(out float height, out float presence) {
        float peak = 0.0;
        for (int i = 0; i < 4; i++) {
          vec4 fault = mix(uFaultFrom[i], uFaultTo[i], uFaultBlend);
          if (fault.z <= 0.001) continue;
          float dx = (aField.x - fault.x) / fault.y;
          float dy = (aField.y - fault.w) / uRidgeDepth;
          float distSq = dx * dx + dy * dy;
          if (distSq < 1.0) {
            float dist = sqrt(distSq);
            float raw = cos(dist * 1.57079632679);
            const float n = 3.2;
            float tn = raw * n;
            float idx = floor(tn);
            float frac = tn - idx;
            float steep = clamp((frac - 0.15) / 0.70, 0.0, 1.0);
            float smoothRiser = steep * steep * (3.0 - 2.0 * steep);
            float stepped = (idx + smoothRiser) / n;
            peak = max(peak, stepped * fault.z);
          }
        }
        float drift = sin(uTime * uDriftSpeed + aPhase) * uDrift;
        height = max(0.08, uBaseHeight + peak * uPeakHeight + aRough + drift);
        float hoverDistance = distance(aWorld, uHover.xy);
        height += exp(-pow(hoverDistance / uHover.z, 2.0)) * uHover.w;
        for (int i = 0; i < 3; i++) {
          if (uShock[i].w <= 0.001) continue;
          float dist = distance(aWorld, uShock[i].xy);
          float waveFront = uShock[i].z;
          float dr = dist - waveFront;

          float envelope = (dr > 0.0)
            ? exp(-pow(dr / 1.5, 2.0))
            : exp(-pow(dr / 14.0, 2.0));

          const float k = 1.396;
          float phase = -dr * k;
          float stokes = (cos(phase) + 0.30 * cos(2.0 * phase) + 0.20) * 0.75;
          float radialDecay = 1.0 / sqrt(1.0 + dist * 0.07);
          float wave = stokes * envelope * radialDecay * uShockStrength * uShock[i].w;

          height += wave;
        }
        height = max(0.08, height);
        height = uHeightLimit - log(1.0 + exp(uHeightLimit - height));

        float core = exp(-pow((aField.x - 0.72) / 0.24, 2.0) - pow((aField.y - 0.42) / 0.33, 2.0));
        float fracture = step(0.22, fract(sin(aPhase * 17.13) * 43758.54));
        float specimen = clamp(core * (0.72 + fracture * 0.55), 0.0, 1.0);
        presence = mix(1.0, specimen, uTrace);
        vHeight = clamp((height - uBaseHeight) / uPeakHeight, 0.0, 1.0);
      }
  `;

  const massMaterial = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    vertexShader: `
      ${heightShader}
      varying vec3 vNormal;
      void main() {
        float height;
        float presence;
        computeFaultHeight(height, presence);
        vPresence = presence;
        vNormal = normal;

        vec3 local = position;
        local.xz *= uBlock;
        local.y = (position.y + 0.5) * height;
        vec3 world = vec3(aWorld.x + local.x, local.y, aWorld.y + local.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uMassColor;
      uniform float uTerrainReveal;
      uniform float uMeshOpacity;
      varying vec3 vNormal;
      varying float vPresence;

      void main() {
        if (vPresence < 0.025 || uTerrainReveal < 0.001) discard;
        float light = 0.68 + 0.32 * max(dot(normalize(vNormal), normalize(vec3(0.5, 0.8, 0.35))), 0.0);
        vec3 mass = uMassColor * light;
        gl_FragColor = vec4(mass, uMeshOpacity * vPresence * uTerrainReveal);
      }
    `
  });

  const linePositions = [];
  const lineKinds = [];
  const segments = [
    [-0.5, 0.5, -0.5,  0.5, 0.5, -0.5, 1],
    [ 0.5, 0.5, -0.5,  0.5, 0.5,  0.5, 1],
    [ 0.5, 0.5,  0.5, -0.5, 0.5,  0.5, 1],
    [-0.5, 0.5,  0.5, -0.5, 0.5, -0.5, 1],
    [-0.5,-0.5, -0.5, -0.5, 0.5, -0.5, 0],
    [ 0.5,-0.5, -0.5,  0.5, 0.5, -0.5, 0],
    [ 0.5,-0.5,  0.5,  0.5, 0.5,  0.5, 0],
    [-0.5,-0.5,  0.5, -0.5, 0.5,  0.5, 0]
  ];
  segments.forEach(segment => {
    linePositions.push(...segment.slice(0, 6));
    lineKinds.push(segment[6], segment[6]);
  });

  const lineGeometry = new THREE.InstancedBufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('aKind', new THREE.Float32BufferAttribute(lineKinds, 1));
  lineGeometry.setAttribute('aWorld', worldAttribute);
  lineGeometry.setAttribute('aField', fieldAttribute);
  lineGeometry.setAttribute('aRough', roughAttribute);
  lineGeometry.setAttribute('aPhase', phaseAttribute);

  const lineMaterial = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      ${heightShader}
      attribute float aKind;
      varying float vKind;
      void main() {
        float height;
        float presence;
        computeFaultHeight(height, presence);
        vPresence = presence;
        vKind = aKind;
        vec3 local = position;
        local.xz *= uBlock;
        local.y = (position.y + 0.5) * height;
        vec3 world = vec3(aWorld.x + local.x, local.y, aWorld.y + local.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uSignalColor;
      uniform vec3 uAccentColor;
      uniform float uTerrainReveal;
      uniform float uCapOpacity;
      uniform float uPillarOpacity;
      uniform float uTrace;
      varying float vKind;
      varying float vHeight;
      varying float vPresence;
      void main() {
        if (vPresence < 0.025 || uTerrainReveal < 0.001) discard;
        float heightContrast = smoothstep(0.015, 0.88, vHeight);
        float lineBase = mix(uPillarOpacity, uCapOpacity, vKind);
        float alpha = lineBase * mix(0.10, 1.85, pow(heightContrast, 0.68));
        alpha *= mix(1.0, 1.65, uTrace) * vPresence;

        float ikbProgress = smoothstep(0.18, 0.88, vHeight);
        vec3 finalLine = mix(uSignalColor, uAccentColor, ikbProgress);
        float luminanceBoost = 1.0 + ikbProgress * 0.40;
        gl_FragColor = vec4(finalLine * luminanceBoost, clamp(alpha * uTerrainReveal, 0.0, 1.0));
      }
    `
  });

  const mesh = new THREE.Mesh(geometry, massMaterial);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  scene.add(mesh);
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.frustumCulled = false;
  lines.renderOrder = 1;
  scene.add(lines);

  const columns = config.columns;
  const rows = config.rows;
  const count = columns * rows;
  const xWorld = new Float32Array(count);
  const zWorld = new Float32Array(count);
  const uField = new Float32Array(count);
  const depthField = new Float32Array(count);
  const spacing = config.blockSize + config.gap;
  const halfColumns = (columns - 1) * 0.5;
  const depthOrigin = (rows - 1) * config.ridgeCenter;
  let index = 0;
  for (let column = 0; column < columns; column++) {
    const line = (column - halfColumns) * spacing;
    for (let row = 0; row < rows; row++) {
      const depth = (row - depthOrigin) * spacing;
      const x = (line + depth) / Math.SQRT2;
      const z = (-line + depth) / Math.SQRT2;
      const u = column / Math.max(columns - 1, 1);
      const d = row / Math.max(rows - 1, 1);
      const rough = (hash(column, row) - 0.5) * config.relief + Math.sin(column * 0.73 + row * 1.31) * config.relief * 0.22;
      xWorld[index] = x;
      zWorld[index] = z;
      uField[index] = u;
      depthField[index] = d;
      worldData[index * 2] = x;
      worldData[index * 2 + 1] = z;
      fieldData[index * 2] = u;
      fieldData[index * 2 + 1] = d;
      roughData[index] = rough;
      phaseData[index] = column * 0.37 + row * 0.19;
      index++;
    }
  }
  geometry.instanceCount = count;
  lineGeometry.instanceCount = count;
  worldAttribute.needsUpdate = true;
  fieldAttribute.needsUpdate = true;
  roughAttribute.needsUpdate = true;
  phaseAttribute.needsUpdate = true;

  const pointer = { clientX: -999, clientY: -999, active: false, dirty: false };
  const magnet = {
    x: 999, z: 999, strength: 0,
    targetX: 999, targetZ: 999, targetStrength: 0
  };
  const shocks = [];
  const view = { translateX: 0, translateY: config.surfaceOffset, scaleX: 1, scaleY: 1, trace: 0 };
  const viewProjection = new THREE.Matrix4();
  let width = innerWidth;
  let height = innerHeight;
  let dpr = 1;
  let running = true;
  let rafId = 0;
  let lastFrame = performance.now();
  let sceneTimeStart = performance.now();

  function scheduleFrame() {
    if (!running || rafId) return;
    rafId = requestAnimationFrame(frame);
  }

  function cancelFrame() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }
  const curtain = {
    running: false,
    start: 0,
    maxEnd: 0,
    mesh: null,
    lines: null,
    uniforms: null,
    failSafe: 0
  };

  function setFaultUniforms() {
    fault.from.forEach((value, i) => fromUniform[i].copy(value));
    fault.to.forEach((value, i) => toUniform[i].copy(value));
    uniforms.uFaultBlend.value = fault.blend;
  }

  function updateFaults(now) {
    if (reduced) return;
    if (!fault.blending && now >= fault.nextAt) {
      fault.blending = true;
      fault.blendStart = now;
      const planned = planFaultTransition(fault.from, ++seed);
      fault.from = planned.updatedFrom;
      fault.to = planned.toSlots;
      fault.blendDuration = 2600 + (seed % 1000);
      setFaultUniforms();
    }
    if (fault.blending) {
      fault.blend = smooth(clamp((now - fault.blendStart) / fault.blendDuration, 0, 1));
      uniforms.uFaultBlend.value = fault.blend;
      if (fault.blend >= 1) {
        fault.from = fault.to.map(value => value.clone());
        fault.to = fault.from.map(value => value.clone());
        fault.blend = 0;
        fault.blending = false;
        fault.nextAt = now + 4500 + ((seed * 17) % 3500);
        setFaultUniforms();
      }
    }
  }

  function blendedFault(i) {
    const from = fault.from[i];
    const to = fault.to[i];
    return {
      x: mix(from.x, to.x, fault.blend),
      y: mix(from.y, to.y, fault.blend),
      z: mix(from.z, to.z, fault.blend),
      w: mix(from.w, to.w, fault.blend)
    };
  }

  function cpuMountain(u, d, faultItem) {
    if (faultItem.z <= 0.001) return 0;
    const dx = (u - faultItem.x) / faultItem.y;
    const dy = (d - faultItem.w) / config.ridgeDepth;
    const distSq = dx * dx + dy * dy;
    if (distSq >= 1.0) return 0;
    const dist = Math.sqrt(distSq);
    const raw = Math.cos(dist * Math.PI * 0.5);
    const n = 3.2;
    const tn = raw * n;
    const idx = Math.floor(tn);
    const frac = tn - idx;
    const steep = Math.min(1, Math.max(0, (frac - 0.15) / 0.70));
    const smoothRiser = steep * steep * (3 - 2 * steep);
    const stepped = (idx + smoothRiser) / n;
    return stepped * faultItem.z;
  }

  function cpuHeight(i, now) {
    let peak = 0;
    for (let f = 0; f < 4; f++) {
      const item = blendedFault(f);
      peak = Math.max(peak, cpuMountain(uField[i], depthField[i], item));
    }
    const drift = reduced ? 0 : Math.sin(now * 0.001 * config.driftSpeed + phaseData[i]) * config.drift;
    return Math.max(0.08, config.baseHeight + peak * config.peakHeight + roughData[i] + drift);
  }

  function createCurtain() {
    if (!curtainEligible || mobile || reduced) return false;

    const curtainSeed = (Date.now() ^ seed ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    const random = mulberry32(curtainSeed || 49157);
    const targetRow = Math.round(config.ridgeCenter * (rows - 1));
    const curtainWorld = new Float32Array(columns * 2);
    const curtainTarget = new Float32Array(columns);
    const curtainStart = new Float32Array(columns);
    const curtainDelay = new Float32Array(columns);
    const curtainDuration = new Float32Array(columns);

    let maxEnd = 0;
    for (let column = 0; column < columns; column++) {
      const source = column * rows + targetRow;
      const normalized = column / Math.max(columns - 1, 1);
      const fieldA = clamp(
        0.5 + Math.sin(normalized * 17.9 + curtainSeed * 0.00013) * 0.24
          + Math.sin(normalized * 41.3 + 1.7) * 0.14
          + (random() - 0.5) * 0.16,
        0,
        1
      );
      const fieldB = clamp(
        0.5 + Math.sin(normalized * 13.1 + 3.4) * 0.21
          + Math.sin(normalized * 29.7 + curtainSeed * 0.00007) * 0.17
          + (random() - 0.5) * 0.18,
        0,
        1
      );
      const target = cpuHeight(source, 0);
      const delay = 0.012 + fieldA * 0.168;
      const duration = 0.86 + fieldB * 0.39;

      curtainWorld[column * 2] = xWorld[source];
      curtainWorld[column * 2 + 1] = zWorld[source];
      curtainTarget[column] = target;
      curtainStart[column] = target + 46 + fieldA * 10 + random() * 7;
      curtainDelay[column] = delay;
      curtainDuration[column] = duration;
      maxEnd = Math.max(maxEnd, delay + duration);
    }

    const attachAttributes = (targetGeometry) => {
      targetGeometry.setAttribute('aCurtainWorld', new THREE.InstancedBufferAttribute(curtainWorld, 2));
      targetGeometry.setAttribute('aCurtainTarget', new THREE.InstancedBufferAttribute(curtainTarget, 1));
      targetGeometry.setAttribute('aCurtainStart', new THREE.InstancedBufferAttribute(curtainStart, 1));
      targetGeometry.setAttribute('aCurtainDelay', new THREE.InstancedBufferAttribute(curtainDelay, 1));
      targetGeometry.setAttribute('aCurtainDuration', new THREE.InstancedBufferAttribute(curtainDuration, 1));
      targetGeometry.instanceCount = columns;
    };

    const curtainGeometry = new THREE.InstancedBufferGeometry();
    curtainGeometry.index = baseGeometry.index;
    Object.keys(baseGeometry.attributes).forEach((name) => {
      curtainGeometry.setAttribute(name, baseGeometry.attributes[name]);
    });
    attachAttributes(curtainGeometry);

    const curtainLineGeometry = new THREE.InstancedBufferGeometry();
    curtainLineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    attachAttributes(curtainLineGeometry);

    const curtainUniforms = {
      uCurtainTime: { value: 0 },
      uCurtainBlock: { value: spacing * 1.018 },
      uCurtainMass: { value: new THREE.Color(config.palette.mass) },
      uCurtainSignal: { value: new THREE.Color(config.palette.signal) }
    };

    const curtainVertex = `
      precision highp float;
      attribute vec2 aCurtainWorld;
      attribute float aCurtainTarget;
      attribute float aCurtainStart;
      attribute float aCurtainDelay;
      attribute float aCurtainDuration;
      uniform float uCurtainTime;
      uniform float uCurtainBlock;
      varying float vCurtainProgress;
      varying vec3 vCurtainNormal;

      float smootherstep(float value) {
        return value * value * value * (value * (value * 6.0 - 15.0) + 10.0);
      }

      void main() {
        float raw = clamp((uCurtainTime - aCurtainDelay) / aCurtainDuration, 0.0, 1.0);
        float progress = smootherstep(raw);
        float height = mix(aCurtainStart, aCurtainTarget, progress);
        float floor = -30.0;
        vec3 local = position;
        local.xz *= uCurtainBlock;
        local.y = floor + (position.y + 0.5) * (height - floor);
        vec3 world = vec3(aCurtainWorld.x + local.x, local.y, aCurtainWorld.y + local.z);
        vCurtainProgress = raw;
        vCurtainNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(world, 1.0);
      }
    `;

    const curtainMaterial = new THREE.ShaderMaterial({
      uniforms: curtainUniforms,
      transparent: false,
      depthWrite: true,
      depthTest: true,
      vertexShader: curtainVertex,
      fragmentShader: `
        precision highp float;
        uniform vec3 uCurtainMass;
        varying float vCurtainProgress;
        varying vec3 vCurtainNormal;
        void main() {
          if (vCurtainProgress >= 0.992) discard;
          float light = 0.72 + 0.28 * max(dot(normalize(vCurtainNormal), normalize(vec3(0.5, 0.8, 0.35))), 0.0);
          gl_FragColor = vec4(uCurtainMass * light, 1.0);
        }
      `
    });

    const curtainLineMaterial = new THREE.ShaderMaterial({
      uniforms: curtainUniforms,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      vertexShader: curtainVertex,
      fragmentShader: `
        precision highp float;
        uniform vec3 uCurtainSignal;
        varying float vCurtainProgress;
        void main() {
          if (vCurtainProgress >= 0.992) discard;
          gl_FragColor = vec4(uCurtainSignal, 0.82);
        }
      `
    });

    curtain.mesh = new THREE.Mesh(curtainGeometry, curtainMaterial);
    curtain.mesh.frustumCulled = false;
    curtain.mesh.renderOrder = 10;
    curtain.lines = new THREE.LineSegments(curtainLineGeometry, curtainLineMaterial);
    curtain.lines.frustumCulled = false;
    curtain.lines.renderOrder = 11;
    curtain.uniforms = curtainUniforms;
    curtain.maxEnd = maxEnd;
    uniforms.uTerrainReveal.value = 0;
    scene.add(curtain.mesh, curtain.lines);
    return true;
  }

  function finishCurtain(now = performance.now()) {
    document.documentElement.classList.remove('curtain-pending', 'curtain-running');
    if (!curtain.running && !curtain.mesh) {
      return;
    }
    curtain.running = false;
    if (curtain.failSafe) clearTimeout(curtain.failSafe);
    if (curtain.mesh) {
      scene.remove(curtain.mesh);
      curtain.mesh.geometry.dispose();
      curtain.mesh.material.dispose();
    }
    if (curtain.lines) {
      scene.remove(curtain.lines);
      curtain.lines.geometry.dispose();
      curtain.lines.material.dispose();
    }
    curtain.mesh = null;
    curtain.lines = null;
    curtain.uniforms = null;
    uniforms.uTerrainReveal.value = 1;
    sceneTimeStart = now;
    lastFrame = now;
    updateCamera();
    updateView();
    try {
      renderer.render(scene, camera);
    } catch (_) {
      stage.hidden = true;
      fallback.hidden = false;
      if (typeof window.startFallbackTerrain === 'function') {
        window.startFallbackTerrain();
      }
    }
  }

  function updateCamera() {
    const aspect = width / Math.max(height, 1);
    if (aspect > 1.82) {
      const horizSpan = config.cameraSize * 1.80;
      camera.left = -horizSpan;
      camera.right = horizSpan;
      camera.top = horizSpan / aspect;
      camera.bottom = -horizSpan / aspect;
    } else {
      camera.left = -config.cameraSize * aspect;
      camera.right = config.cameraSize * aspect;
      camera.top = config.cameraSize;
      camera.bottom = -config.cameraSize;
    }
    const yaw = config.yaw * Math.PI / 180;
    const pitch = config.pitch * Math.PI / 180;
    const distance = 58;
    const targetY = mobile ? 3.0 : 3.8;
    camera.position.set(
      Math.cos(pitch) * Math.sin(yaw) * distance,
      Math.sin(pitch) * distance + targetY,
      Math.cos(pitch) * Math.cos(yaw) * distance
    );
    camera.lookAt(0, targetY, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function applyCurtainView() {
    stage.style.transform = 'none';
    camera.projectionMatrix.elements[13] -= config.surfaceOffset * 0.02;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  function updateView() {
    const page = clamp(scrollY / Math.max(height, 1), 0, 2);
    if (page <= 1) {
      const t = smooth(page);
      view.translateX = 0;
      view.translateY = mix(config.surfaceOffset, config.ceilingOffset, t);
      view.scaleX = 1;
      view.scaleY = mix(1, -1, t);
      view.trace = 0;
    } else {
      const t = smooth(page - 1);
      view.translateX = mix(0, mobile ? 8 : 15, t);
      view.translateY = mix(config.ceilingOffset, mobile ? -13 : -8, t);
      view.scaleX = mix(1, mobile ? 0.72 : 0.64, t);
      view.scaleY = mix(-1, mobile ? -0.72 : -0.64, t);
      view.trace = t;
    }
    stage.style.transform = `translate3d(${view.translateX}vw,${view.translateY}vh,0) scale(${view.scaleX},${view.scaleY})`;
    uniforms.uTrace.value = view.trace;
  }

  function projectionTerms() {
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const e = viewProjection.elements;
    const halfWidth = width * 0.5;
    const halfHeight = height * 0.5;
    return {
      xx: e[0] * halfWidth, yx: e[4] * halfWidth, zx: e[8] * halfWidth,
      xy: -e[1] * halfHeight, yy: -e[5] * halfHeight, zy: -e[9] * halfHeight,
      cx: (e[12] * 0.5 + 0.5) * width,
      cy: (-e[13] * 0.5 + 0.5) * height
    };
  }

  function updatePointerTarget(now) {
    if (!pointer.active || !pointer.dirty) return;
    const p = projectionTerms();
    let nearestDistance = Infinity;
    let weightedX = 0;
    let weightedZ = 0;
    let totalWeight = 0;
    const influencePixels = mobile ? 92 : 126;
    let nearestIndex = -1;
    for (let i = 0; i < count; i++) {
      const h = cpuHeight(i, now);
      const localX = xWorld[i] * p.xx + h * p.yx + zWorld[i] * p.zx + p.cx;
      const localY = xWorld[i] * p.xy + h * p.yy + zWorld[i] * p.zy + p.cy;
      const visualX = width * 0.5 + (localX - width * 0.5) * view.scaleX + view.translateX * width / 100;
      const visualY = height * 0.5 + (localY - height * 0.5) * view.scaleY + view.translateY * height / 100;
      const distance = Math.hypot(visualX - pointer.clientX, visualY - pointer.clientY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
      if (distance < influencePixels) {
        const normalized = distance / influencePixels;
        const weight = Math.exp(-normalized * normalized * 3.4);
        weightedX += xWorld[i] * weight;
        weightedZ += zWorld[i] * weight;
        totalWeight += weight;
      }
    }
    if (totalWeight > 0.01 && nearestDistance < influencePixels) {
      magnet.targetX = weightedX / totalWeight;
      magnet.targetZ = weightedZ / totalWeight;
      const proximity = 1 - clamp(nearestDistance / influencePixels, 0, 1);
      magnet.targetStrength = config.hoverLift * smooth(proximity);
    } else {
      magnet.targetStrength = 0;
      if (nearestIndex >= 0 && nearestDistance < 360) {
        magnet.targetX = xWorld[nearestIndex];
        magnet.targetZ = zWorld[nearestIndex];
      }
    }
    pointer.dirty = false;
  }

  function updateMagnet(dt) {
    if (reduced) {
      uniforms.uHover.value.set(999, 999, config.hoverRadius, 0);
      return;
    }
    if (magnet.x > 900 && magnet.targetX < 900) {
      magnet.x = magnet.targetX;
      magnet.z = magnet.targetZ;
    }
    magnet.x = damp(magnet.x, magnet.targetX, 3.2, dt);
    magnet.z = damp(magnet.z, magnet.targetZ, 3.2, dt);
    magnet.strength = damp(magnet.strength, magnet.targetStrength, magnet.targetStrength > magnet.strength ? 2.2 : 3.8, dt);
    uniforms.uHover.value.set(magnet.x, magnet.z, config.hoverRadius, magnet.strength);
  }

  function updateShocks(dt) {
    for (let i = shocks.length - 1; i >= 0; i--) {
      shocks[i].radius += dt * config.shockSpeed;
      shocks[i].life -= dt * config.shockDecay;
      if (shocks[i].life <= 0) shocks.splice(i, 1);
    }
    for (let i = 0; i < shockUniform.length; i++) {
      const shock = shocks[i];
      if (shock) shockUniform[i].set(shock.x, shock.z, shock.radius, shock.life);
      else shockUniform[i].set(999, 999, 0, 0);
    }
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    dpr = mobile ? Math.min(devicePixelRatio || 1, 1.15) : Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    updateCamera();
    if (curtain.running) applyCurtainView();
    else updateView();
    pointer.dirty = true;
  }

  function handlePointer(event) {
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    pointer.active = true;
    pointer.dirty = true;
  }

  function addShock(event) {
    if (curtain.running || reduced) return;
    if (event.target && typeof event.target.closest === 'function' && event.target.closest('a, button, input, textarea, summary')) return;
    handlePointer(event);
    updatePointerTarget(performance.now() - sceneTimeStart);
    if (magnet.targetStrength > 0 || (magnet.targetX < 900 && magnet.targetZ < 900)) {
      shocks.unshift({ x: magnet.targetX, z: magnet.targetZ, radius: 0, life: 1 });
      shocks.length = Math.min(shocks.length, 3);
    }
  }

  function frame(now) {
    rafId = 0;
    if (!running) return;
    scheduleFrame();

    if (curtain.running) {
      const elapsed = Math.max(0, (now - curtain.start) / 1000);
      curtain.uniforms.uCurtainTime.value = elapsed;
      const revealStart = Math.max(0, curtain.maxEnd - 0.19);
      uniforms.uTerrainReveal.value = smooth(clamp((elapsed - revealStart) / 0.19, 0, 1));
      uniforms.uTime.value = 0;
      renderer.render(scene, camera);
      if (elapsed >= curtain.maxEnd + 0.025) finishCurtain(now);
      return;
    }

    if (mobile && now - lastFrame < 32) return;
    const dt = clamp((now - lastFrame) / 1000, 0, 0.06);
    lastFrame = now;
    const sceneNow = Math.max(0, now - sceneTimeStart);
    updateFaults(now);
    updateView();
    updatePointerTarget(sceneNow);
    updateMagnet(dt);
    updateShocks(dt);
    uniforms.uTime.value = sceneNow * 0.001;
    renderer.render(scene, camera);
  }

  addEventListener('resize', resize);
  addEventListener('scroll', () => {
    if (curtain.running) finishCurtain(performance.now());
    updateView();
    pointer.dirty = true;
  }, { passive: true });
  addEventListener('pointermove', handlePointer, { passive: true });
  addEventListener('pointerleave', () => {
    pointer.active = false;
    magnet.targetStrength = 0;
  });
  addEventListener('pointerdown', addShock);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (curtain.running) finishCurtain(performance.now());
      running = false;
      cancelFrame();
    } else {
      running = true;
      lastFrame = performance.now();
      scheduleFrame();
    }
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    running = false;
    cancelFrame();
    finishCurtain(performance.now());
    stage.hidden = true;
    fallback.hidden = false;
    if (typeof window.startFallbackTerrain === 'function') {
      window.startFallbackTerrain();
    }
  });
  window.pauseTerrain = () => {
    running = false;
    cancelFrame();
  };

  window.resumeTerrain = () => {
    if (!running) {
      running = true;
      lastFrame = performance.now();
      scheduleFrame();
    }
  };

  const mobileMql = matchMedia('(max-width: 820px)');
  mobileMql.addEventListener('change', (e) => {
    mobile = e.matches;
    if (mobile) {
      window.pauseTerrain();
    } else {
      window.resumeTerrain();
      resize();
    }
  });

  const motionMql = matchMedia('(prefers-reduced-motion: reduce)');
  motionMql.addEventListener('change', (e) => {
    reduced = e.matches;
    config.drift = reduced ? 0 : 0.47;
    uniforms.uDrift.value = config.drift;
    if (reduced) {
      uniforms.uHover.value.set(999, 999, config.hoverRadius, 0);
      shocks.length = 0;
    }
  });

  setFaultUniforms();
  resize();
  if (createCurtain()) {
    curtain.running = true;
    curtain.start = performance.now();
    sceneTimeStart = curtain.start;
    updateCamera();
    applyCurtainView();
    curtain.uniforms.uCurtainTime.value = 0;
    uniforms.uTime.value = 0;
    renderer.render(scene, camera);
    if (window.__faultlineCurtainFallback) clearTimeout(window.__faultlineCurtainFallback);
    document.documentElement.classList.add('curtain-running');
    document.documentElement.classList.remove('curtain-pending');
    curtain.failSafe = setTimeout(() => finishCurtain(performance.now()), 1600);
  } else {
    if (window.__faultlineCurtainFallback) clearTimeout(window.__faultlineCurtainFallback);
    document.documentElement.classList.remove('curtain-pending', 'curtain-running');
  }
  window.__faultline = {
    fault,
    config,
    uniforms,
    shocks,
    magnet,
    pointer,
    triggerWave: (x, z) => {
      shocks.unshift({ x: x !== undefined ? x : 0, z: z !== undefined ? z : 0, radius: 0, life: 1 });
      shocks.length = Math.min(shocks.length, 3);
    }
  };
  scheduleFrame();
})();
