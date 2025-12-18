/**
 * Mopec Equipment Configurator
 * Procedural Three.js viewer
 *
 * This module is intentionally DOM-light: it renders to a provided canvas and
 * exposes a small API for UI code to drive (update config, camera presets,
 * blueprint mode, zoom, auto-rotate).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Camera presets tuned for the procedural model scale used here.
 */
export const VIEW_PRESETS = Object.freeze({
  front: { x: 0, y: 2, z: 6 },
  side: { x: 6, y: 2, z: 0 },
  top: { x: 0, y: 8, z: 0.1 },
  iso: { x: 5, y: 3, z: 5 }
});

export const DEFAULT_MODEL_CONFIG = Object.freeze({
  width: 72,
  baseStyle: 'pedestal', // 'pedestal' | 'legs'
  sinkPosition: 'left', // 'left' | 'center' | 'right' | 'none'

  // Features
  hasHeightAdjust: false,
  hasFrontAirSystem: false,
  hasFormalinDetection: false,
  hasDowndraftVent: false,
  hasDisposal: false,
  hasSecondSink: false,

  // Accessories
  hasPathCam: false,
  hasMonitorArm: false,
  hasMagnetBar: false,
  hasDrawers: false,
  hasLedStrip: false,
  hasPegboardWing: false,
  hasFormalinDispenser: false
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isOneOf(value, allowed) {
  return allowed.includes(value);
}

function createMaterials() {
  const stainlessSteel = new THREE.MeshPhysicalMaterial({
    color: 0xd8d8d8,
    metalness: 0.95,
    roughness: 0.15,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.5
  });

  const brushedSteel = new THREE.MeshPhysicalMaterial({
    color: 0xc0c0c0,
    metalness: 0.9,
    roughness: 0.3,
    envMapIntensity: 1.2
  });

  const darkSteel = new THREE.MeshPhysicalMaterial({
    color: 0x606060,
    metalness: 0.85,
    roughness: 0.4,
    envMapIntensity: 1.0
  });

  const plastic = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    metalness: 0.0,
    roughness: 0.6
  });

  const mopecBlue = new THREE.MeshStandardMaterial({
    color: 0x407ec9,
    metalness: 0.1,
    roughness: 0.5
  });

  const mopecOrange = new THREE.MeshStandardMaterial({
    color: 0xfc4c02,
    metalness: 0.1,
    roughness: 0.5
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x88ccff,
    metalness: 0,
    roughness: 0,
    transmission: 0.9,
    transparent: true,
    opacity: 0.3
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0,
    roughness: 0.9
  });

  const emissiveWhite = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.85,
    metalness: 0,
    roughness: 0.3
  });

  return {
    stainlessSteel,
    brushedSteel,
    darkSteel,
    plastic,
    mopecBlue,
    mopecOrange,
    glass,
    rubber,
    emissiveWhite
  };
}

function createDisposer(nonDisposableMaterials) {
  /**
   * Disposes geometries/materials under a root object.
   *
   * Note: we avoid disposing shared materials (the global materials set and
   * blueprint material), and avoid double-disposing shared geometries/materials.
   */
  return function disposeObject3D(root) {
    if (!root) return;
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();

    root.traverse((obj) => {
      if (obj.geometry && !disposedGeometries.has(obj.geometry)) {
        obj.geometry.dispose();
        disposedGeometries.add(obj.geometry);
      }

      const material = obj.material;
      if (!material) return;

      if (Array.isArray(material)) {
        material.forEach((m) => {
          if (!m || nonDisposableMaterials.has(m) || disposedMaterials.has(m)) return;
          m.dispose();
          disposedMaterials.add(m);
        });
        return;
      }

      if (nonDisposableMaterials.has(material) || disposedMaterials.has(material)) return;
      material.dispose();
      disposedMaterials.add(material);
    });
  };
}

function getSinkDims(modelWidthInches) {
  // Keep proportions stable across products while reflecting larger basins on larger stations.
  if (modelWidthInches >= 96) {
    return { outerW: 0.62, outerH: 0.22, outerD: 0.4, innerW: 0.56, innerH: 0.2, innerD: 0.34 };
  }
  if (modelWidthInches <= 60) {
    return { outerW: 0.5, outerH: 0.2, outerD: 0.32, innerW: 0.44, innerH: 0.18, innerD: 0.26 };
  }
  return { outerW: 0.55, outerH: 0.2, outerD: 0.35, innerW: 0.5, innerH: 0.18, innerD: 0.3 };
}

function getSinkXForPosition(position, tableWidth) {
  switch (position) {
    case 'left':
      return -tableWidth / 2 + 0.5;
    case 'center':
      return 0;
    case 'right':
      return tableWidth / 2 - 0.5;
    default:
      return -tableWidth / 2 + 0.5;
  }
}

export class MopecViewer {
  /**
   * @param {object} options
   * @param {HTMLElement} options.container
   * @param {HTMLCanvasElement} options.canvas
   * @param {HTMLElement=} options.loadingIndicator
   */
  constructor({ container, canvas, loadingIndicator } = {}) {
    if (!container) throw new Error('MopecViewer: container is required');
    if (!canvas) throw new Error('MopecViewer: canvas is required');

    this.container = container;
    this.canvas = canvas;
    this.loadingIndicator = loadingIndicator ?? null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.model = null;
    this.modelConfig = { ...DEFAULT_MODEL_CONFIG };
    this.viewMode = 'render'; // 'render' | 'blueprint'
    this.autoRotate = false;

    this._animationId = null;
    this._handleResize = null;

    this._materials = createMaterials();
    this._blueprintMaterial = new THREE.MeshBasicMaterial({
      color: 0x407ec9,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });

    this._nonDisposableMaterials = new Set([
      ...Object.values(this._materials),
      this._blueprintMaterial
    ]);
    this._disposeObject3D = createDisposer(this._nonDisposableMaterials);

    this._originalMaterials = {};

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(5, 3, 5);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      // Enables PDF snapshots from the canvas; slight performance cost but acceptable for this configurator.
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 15;
    this.controls.maxPolarAngle = Math.PI / 2;
    this.controls.target.set(0, 0.9, 0);
    this.controls.update();

    this.setupLighting();
    this.setupEnvironment();

    this.rebuild();

    this._handleResize = () => this.onResize();
    window.addEventListener('resize', this._handleResize);

    this.animate();
    this.hideLoading();
  }

  setupLighting() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.bias = -0.0001;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x88ccff, 0.5);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, 3, -8);
    this.scene.add(rimLight);

    this.scene.add(new THREE.HemisphereLight(0x4488bb, 0x002244, 0.3));
  }

  setupEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(100, 32, 32);
    const envMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0077ff) },
        bottomColor: { value: new THREE.Color(0xffffff) }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    const envRT = pmremGenerator.fromScene(envScene);
    this.scene.environment = envRT.texture;

    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(20, 40, 0x407ec9, 0x1e3a5f);
    gridHelper.position.y = 0;
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  /**
   * Merge config and rebuild the model.
   * @param {Partial<typeof DEFAULT_MODEL_CONFIG>} partial
   */
  update(partial = {}) {
    const next = { ...this.modelConfig, ...partial };
    next.width = clamp(Number(next.width) || 72, 48, 96);
    next.baseStyle = isOneOf(next.baseStyle, ['pedestal', 'legs']) ? next.baseStyle : 'pedestal';
    next.sinkPosition = isOneOf(next.sinkPosition, ['left', 'center', 'right', 'none']) ? next.sinkPosition : 'left';

    // Safety: second sink only on 96" models.
    if (next.width < 96) next.hasSecondSink = false;

    this.modelConfig = next;
    this.rebuild();
  }

  rebuild() {
    if (this.model) {
      this.scene.remove(this.model);
      this._disposeObject3D(this.model);
      this.model = null;
    }

    this._originalMaterials = {};
    this.model = this.createMaestroModel();
    this.scene.add(this.model);

    this.model.traverse((child) => {
      if (child.isMesh) {
        this._originalMaterials[child.uuid] = child.material;
      }
    });

    if (this.viewMode === 'blueprint') {
      this.applyBlueprintMode();
    } else {
      this.applyRenderMode();
    }

    this.validateModel();
  }

  validateModel() {
    /**
     * Lightweight sanity checks to ensure optional parts render when enabled and
     * don’t end up far off the station.
     *
     * This intentionally logs warnings (doesn’t throw) so the UI keeps working
     * even if a part is missing.
     */
    if (!this.model) return;

    const expected = new Set([
      'tableTop',
      'drainArea',
      'drainHoles',
      'pegboard',
      'hood',
      'controlPanel',
      'base',
      'brandingAccent'
    ]);

    const cfg = this.modelConfig;
    if (cfg.sinkPosition !== 'none') expected.add('sink');
    if (cfg.sinkPosition !== 'none' && cfg.hasDisposal) expected.add('disposal');
    if (cfg.width >= 96 && cfg.hasSecondSink && cfg.sinkPosition !== 'none') expected.add('secondSink');

    if (cfg.hasPegboardWing) expected.add('pegboardWing');
    if (cfg.hasLedStrip) expected.add('ledStrip');
    if (cfg.hasFrontAirSystem) expected.add('frontAirSystem');
    if (cfg.hasDowndraftVent) expected.add('downdraftVents');
    if (cfg.hasFormalinDetection) expected.add('formalinSensor');
    if (cfg.hasHeightAdjust) expected.add('heightAdjustMechanism');

    if (cfg.hasMonitorArm) expected.add('monitorArm');
    if (cfg.hasMagnetBar) expected.add('magnetBar');
    if (cfg.hasDrawers) expected.add('drawers');
    if (cfg.hasPathCam) expected.add('pathCam');
    if (cfg.hasFormalinDispenser && cfg.sinkPosition !== 'none') expected.add('formalinDispenser');

    const rootBox = new THREE.Box3().setFromObject(this.model);
    const maxRadius = Math.max(Math.abs(rootBox.min.x), Math.abs(rootBox.max.x)) + 0.5;

    expected.forEach((name) => {
      const obj = this.model.getObjectByName(name);
      if (!obj) {
        console.warn(`[MopecViewer] Missing expected part: ${name}`);
        return;
      }
      const box = new THREE.Box3().setFromObject(obj);
      const center = box.getCenter(new THREE.Vector3());
      if (box.min.y < -0.2) {
        console.warn(`[MopecViewer] Part "${name}" below ground: minY=${box.min.y.toFixed(3)}`);
      }
      if (Math.abs(center.x) > maxRadius * 1.2) {
        console.warn(`[MopecViewer] Part "${name}" far from station center: x=${center.x.toFixed(3)}`);
      }
      if (Math.abs(center.z) > 2.5) {
        console.warn(`[MopecViewer] Part "${name}" far in depth: z=${center.z.toFixed(3)}`);
      }
    });
  }

  createMaestroModel() {
    const m = this._materials;
    const group = new THREE.Group();
    group.name = 'maestro';

    const widthScale = this.modelConfig.width / 72;
    const tableWidth = 3.0 * widthScale;

    // ---- TABLE TOP ----
    const tableTopGroup = new THREE.Group();
    tableTopGroup.name = 'tableTop';
    const tableTopGeometry = new THREE.BoxGeometry(tableWidth, 0.08, 0.9);
    const tableTop = new THREE.Mesh(tableTopGeometry, m.stainlessSteel);
    tableTop.position.y = 0.95;
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableTopGroup.add(tableTop);
    this.createRim(tableTopGroup, tableWidth + 0.05, 0.9, 0.04, 0.99);
    group.add(tableTopGroup);

    // Work surface dark insert
    const drainAreaGeometry = new THREE.BoxGeometry(tableWidth * 0.4, 0.01, 0.6);
    const drainArea = new THREE.Mesh(drainAreaGeometry, m.darkSteel);
    drainArea.name = 'drainArea';
    drainArea.position.set(tableWidth * 0.15, 0.96, 0);
    group.add(drainArea);

    // Drain holes (instanced)
    {
      const holeGeometry = new THREE.CircleGeometry(0.02, 8);
      const step = 0.12;
      const xStart = -tableWidth * 0.15;
      const xEnd = tableWidth * 0.15 + 1e-6;
      const zStart = -0.24;
      const zEnd = 0.24 + 1e-6;

      const xCount = Math.floor((xEnd - xStart) / step) + 1;
      const zCount = Math.floor((zEnd - zStart) / step) + 1;
      const count = xCount * zCount;
      const holes = new THREE.InstancedMesh(holeGeometry, m.darkSteel, count);
      holes.name = 'drainHoles';

      const tmp = new THREE.Object3D();
      tmp.rotation.x = -Math.PI / 2;
      let i = 0;
      for (let xi = 0; xi < xCount; xi++) {
        const x = xStart + xi * step;
        for (let zi = 0; zi < zCount; zi++) {
          const z = zStart + zi * step;
          tmp.position.set(tableWidth * 0.15 + x, 0.965, z);
          tmp.updateMatrix();
          holes.setMatrixAt(i++, tmp.matrix);
        }
      }
      holes.instanceMatrix.needsUpdate = true;
      group.add(holes);
    }

    // ---- SINK(S) + DISPOSAL ----
    this.createSinkAssembly(group, tableWidth);

    // ---- PEGBOARD ----
    const pegboard = this.createPegboard(tableWidth);
    pegboard.name = 'pegboard';
    group.add(pegboard);
    if (this.modelConfig.hasPegboardWing) {
      const wing = this.createPegboardWing(tableWidth);
      wing.name = 'pegboardWing';
      group.add(wing);
    }

    // ---- VENTILATION HOOD ----
    const hood = this.createHood(tableWidth);
    hood.name = 'hood';
    group.add(hood);

    // ---- CONTROL PANEL (touchscreen is included) ----
    const controlPanel = this.createControlPanel(tableWidth);
    controlPanel.name = 'controlPanel';
    group.add(controlPanel);

    // ---- BASE ----
    const base = this.createBase(tableWidth);
    base.name = 'base';
    group.add(base);

    // ---- LED STRIP (optional accessory) ----
    if (this.modelConfig.hasLedStrip) {
      const ledStrip = this.createLedStrip(tableWidth);
      ledStrip.name = 'ledStrip';
      group.add(ledStrip);
    }

    // ---- FEATURE VISUALS ----
    if (this.modelConfig.hasFrontAirSystem) {
      const fas = this.createFrontAirSystem(tableWidth);
      fas.name = 'frontAirSystem';
      group.add(fas);
    }
    if (this.modelConfig.hasDowndraftVent) {
      const downdraft = this.createDowndraftVents(tableWidth);
      downdraft.name = 'downdraftVents';
      group.add(downdraft);
    }
    if (this.modelConfig.hasFormalinDetection) {
      const sensor = this.createFormalinSensor(tableWidth);
      sensor.name = 'formalinSensor';
      group.add(sensor);
    }
    if (this.modelConfig.hasHeightAdjust) {
      const heightAdjust = this.createHeightAdjustMechanism(tableWidth);
      heightAdjust.name = 'heightAdjustMechanism';
      group.add(heightAdjust);
    }

    // ---- ACCESSORIES ----
    if (this.modelConfig.hasMonitorArm) {
      const monitorArm = this.createMonitorArm();
      monitorArm.name = 'monitorArm';
      group.add(monitorArm);
    }
    if (this.modelConfig.hasMagnetBar) {
      const magnetBar = this.createMagnetBar(tableWidth);
      magnetBar.name = 'magnetBar';
      group.add(magnetBar);
    }
    if (this.modelConfig.hasDrawers) {
      const drawers = this.createDrawers(tableWidth);
      drawers.name = 'drawers';
      group.add(drawers);
    }
    if (this.modelConfig.hasPathCam) {
      const pathCam = this.createPathCam();
      pathCam.name = 'pathCam';
      group.add(pathCam);
    }
    if (this.modelConfig.hasFormalinDispenser) {
      const position = this.modelConfig.sinkPosition;
      if (position !== 'none') {
        const dispenser = this.createFormalinDispenser(tableWidth);
        dispenser.name = 'formalinDispenser';
        group.add(dispenser);
      }
    }

    // ---- BRANDING ACCENT ----
    const accentGeometry = new THREE.BoxGeometry(0.02, 0.6, 0.02);
    const accent = new THREE.Mesh(accentGeometry, m.mopecOrange);
    accent.name = 'brandingAccent';
    accent.position.set(-tableWidth / 2 - 0.02, 1.4, -0.47);
    group.add(accent);

    return group;
  }

  createSinkAssembly(group, tableWidth) {
    const position = this.modelConfig.sinkPosition;
    const m = this._materials;

    if (position === 'none') {
      // No sink means no disposal, and second sink doesn't render.
      return;
    }

    const { outerW, outerH, outerD, innerW, innerH, innerD } = getSinkDims(this.modelConfig.width);

    const wantsDualSink = this.modelConfig.hasSecondSink && this.modelConfig.width >= 96;

    // Special case: dual-sink configs with "center" selected should render a symmetric left + right pair
    // instead of a center + right overlap.
    if (wantsDualSink && position === 'center') {
      const leftX = getSinkXForPosition('left', tableWidth);
      const rightX = getSinkXForPosition('right', tableWidth);

      const sinkOuterGeometry = new THREE.BoxGeometry(outerW, outerH, outerD);
      const sinkInnerGeometry = new THREE.BoxGeometry(innerW, innerH, innerD);

      const leftGroup = new THREE.Group();
      leftGroup.name = 'sink';
      const leftOuter = new THREE.Mesh(sinkOuterGeometry, m.stainlessSteel);
      leftOuter.position.set(leftX, 0.85, 0);
      leftOuter.castShadow = true;
      leftGroup.add(leftOuter);

      const leftInner = new THREE.Mesh(sinkInnerGeometry, m.darkSteel);
      leftInner.position.set(leftX, 0.85 + (outerH - innerH) / 2, 0);
      leftGroup.add(leftInner);
      this.createFaucet(leftGroup, leftX - 0.25, 0.95, 0.3);
      group.add(leftGroup);

      const rightGroup = new THREE.Group();
      rightGroup.name = 'secondSink';
      const rightOuter = new THREE.Mesh(sinkOuterGeometry, m.stainlessSteel);
      rightOuter.position.set(rightX, 0.85, 0);
      rightOuter.castShadow = true;
      rightGroup.add(rightOuter);

      const rightInner = new THREE.Mesh(sinkInnerGeometry, m.darkSteel);
      rightInner.position.set(rightX, 0.85 + (outerH - innerH) / 2, 0);
      rightGroup.add(rightInner);
      this.createFaucet(rightGroup, rightX - 0.25, 0.95, 0.3);
      group.add(rightGroup);

      if (this.modelConfig.hasDisposal) {
        const disposal = this.createDisposal(leftX);
        disposal.name = 'disposal';
        group.add(disposal);
      }

      return;
    }

    const sinkX = getSinkXForPosition(position, tableWidth);
    const sinkGroup = new THREE.Group();
    sinkGroup.name = 'sink';

    const sinkOuterGeometry = new THREE.BoxGeometry(outerW, outerH, outerD);
    const sinkOuter = new THREE.Mesh(sinkOuterGeometry, m.stainlessSteel);
    sinkOuter.position.set(sinkX, 0.85, 0);
    sinkOuter.castShadow = true;
    sinkGroup.add(sinkOuter);

    const sinkInnerGeometry = new THREE.BoxGeometry(innerW, innerH, innerD);
    const sinkInner = new THREE.Mesh(sinkInnerGeometry, m.darkSteel);
    sinkInner.position.set(sinkX, 0.85 + (outerH - innerH) / 2, 0);
    sinkGroup.add(sinkInner);

    this.createFaucet(sinkGroup, sinkX - 0.25, 0.95, 0.3);
    group.add(sinkGroup);

    if (this.modelConfig.hasDisposal) {
      const disposal = this.createDisposal(sinkX);
      disposal.name = 'disposal';
      group.add(disposal);
    }

    if (wantsDualSink) {
      const secondPosition = position === 'left' ? 'right' : position === 'right' ? 'left' : 'right';
      const secondX = getSinkXForPosition(secondPosition, tableWidth);
      const secondGroup = new THREE.Group();
      secondGroup.name = 'secondSink';

      const secondOuter = new THREE.Mesh(sinkOuterGeometry, m.stainlessSteel);
      secondOuter.position.set(secondX, 0.85, 0);
      secondOuter.castShadow = true;
      secondGroup.add(secondOuter);

      const secondInner = new THREE.Mesh(sinkInnerGeometry, m.darkSteel);
      secondInner.position.set(secondX, 0.85 + (outerH - innerH) / 2, 0);
      secondGroup.add(secondInner);

      this.createFaucet(secondGroup, secondX - 0.25, 0.95, 0.3);
      group.add(secondGroup);
    }
  }

  createFaucet(group, x, y, z) {
    const m = this._materials;

    const baseGeometry = new THREE.CylinderGeometry(0.025, 0.03, 0.1, 16);
    const base = new THREE.Mesh(baseGeometry, m.stainlessSteel);
    base.position.set(x, y + 0.05, z);
    group.add(base);

    const neckGeometry = new THREE.CylinderGeometry(0.015, 0.015, 0.25, 16);
    const neck = new THREE.Mesh(neckGeometry, m.stainlessSteel);
    neck.position.set(x, y + 0.225, z);
    group.add(neck);

    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x, y + 0.35, z),
      new THREE.Vector3(x + 0.1, y + 0.38, z),
      new THREE.Vector3(x + 0.15, y + 0.3, z)
    );
    const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.012, 8, false);
    const spout = new THREE.Mesh(tubeGeometry, m.stainlessSteel);
    group.add(spout);

    const handleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.06, 16);
    const handle = new THREE.Mesh(handleGeometry, m.brushedSteel);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(x + 0.05, y + 0.15, z);
    group.add(handle);
  }

  createDisposal(sinkX) {
    const m = this._materials;
    const disposalGroup = new THREE.Group();
    const disposalGeometry = new THREE.CylinderGeometry(0.1, 0.12, 0.25, 16);
    const disposal = new THREE.Mesh(disposalGeometry, m.darkSteel);
    disposal.position.set(sinkX, 0.62, 0);
    disposalGroup.add(disposal);
    return disposalGroup;
  }

  createPegboard(tableWidth) {
    const m = this._materials;
    const pegboardGroup = new THREE.Group();

    const pegboardGeometry = new THREE.BoxGeometry(tableWidth - 0.2, 0.8, 0.03);
    const pegboard = new THREE.Mesh(pegboardGeometry, m.brushedSteel);
    pegboard.position.set(0, 1.4, -0.47);
    pegboard.castShadow = true;
    pegboardGroup.add(pegboard);

    const holeGeometry = new THREE.CircleGeometry(0.012, 8);
    const stepX = 0.15;
    const stepY = 0.1;
    const xStart = -(tableWidth / 2) + 0.3;
    const xEnd = (tableWidth / 2) - 0.3 + 1e-6;
    const yStart = 1.1;
    const yEnd = 1.65 + 1e-6;

    const xCount = Math.floor((xEnd - xStart) / stepX) + 1;
    const yCount = Math.floor((yEnd - yStart) / stepY) + 1;
    const count = xCount * yCount;
    const holes = new THREE.InstancedMesh(holeGeometry, m.darkSteel, count);

    const tmp = new THREE.Object3D();
    let i = 0;
    for (let xi = 0; xi < xCount; xi++) {
      const x = xStart + xi * stepX;
      for (let yi = 0; yi < yCount; yi++) {
        const y = yStart + yi * stepY;
        tmp.position.set(x, y, -0.455);
        tmp.updateMatrix();
        holes.setMatrixAt(i++, tmp.matrix);
      }
    }
    holes.instanceMatrix.needsUpdate = true;
    pegboardGroup.add(holes);

    return pegboardGroup;
  }

  createPegboardWing(tableWidth) {
    const m = this._materials;

    const wingGroup = new THREE.Group();
    const wingW = 0.55;
    const wingH = 0.8;
    const wingD = 0.03;

    const wingGeometry = new THREE.BoxGeometry(wingW, wingH, wingD);
    const wing = new THREE.Mesh(wingGeometry, m.brushedSteel);
    wing.position.set(-(tableWidth / 2) - wingW / 2 - 0.05, 1.4, -0.47);
    wing.castShadow = true;
    wingGroup.add(wing);

    const holeGeometry = new THREE.CircleGeometry(0.012, 8);
    const stepX = 0.14;
    const stepY = 0.1;
    const xStart = -(wingW / 2) + 0.09;
    const xEnd = wingW / 2 - 0.09 + 1e-6;
    const yStart = -(wingH / 2) + 0.1;
    const yEnd = wingH / 2 - 0.1 + 1e-6;

    const xCount = Math.floor((xEnd - xStart) / stepX) + 1;
    const yCount = Math.floor((yEnd - yStart) / stepY) + 1;
    const count = xCount * yCount;

    const holes = new THREE.InstancedMesh(holeGeometry, m.darkSteel, count);
    const tmp = new THREE.Object3D();
    let i = 0;
    for (let xi = 0; xi < xCount; xi++) {
      const x = xStart + xi * stepX;
      for (let yi = 0; yi < yCount; yi++) {
        const y = yStart + yi * stepY;
        tmp.position.set(wing.position.x + x, wing.position.y + y, -0.455);
        tmp.updateMatrix();
        holes.setMatrixAt(i++, tmp.matrix);
      }
    }
    holes.instanceMatrix.needsUpdate = true;
    wingGroup.add(holes);

    return wingGroup;
  }

  createHood(tableWidth) {
    const m = this._materials;
    const hoodGroup = new THREE.Group();

    const hoodGeometry = new THREE.BoxGeometry(tableWidth - 0.4, 0.15, 0.4);
    const hood = new THREE.Mesh(hoodGeometry, m.stainlessSteel);
    hood.position.set(0, 1.87, -0.35);
    hood.castShadow = true;
    hoodGroup.add(hood);

    const hoodLipGeometry = new THREE.BoxGeometry(tableWidth - 0.35, 0.08, 0.03);
    const hoodLip = new THREE.Mesh(hoodLipGeometry, m.brushedSteel);
    hoodLip.position.set(0, 1.8, -0.13);
    hoodGroup.add(hoodLip);

    return hoodGroup;
  }

  createControlPanel(tableWidth) {
    const m = this._materials;
    const panelGroup = new THREE.Group();

    const panelGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.02);
    const panel = new THREE.Mesh(panelGeometry, m.plastic);
    panel.position.set(tableWidth / 2 - 0.3, 1.2, -0.45);
    panelGroup.add(panel);

    const screenGeometry = new THREE.BoxGeometry(0.25, 0.15, 0.005);
    const screen = new THREE.Mesh(screenGeometry, m.mopecBlue);
    screen.position.set(tableWidth / 2 - 0.3, 1.2, -0.435);
    panelGroup.add(screen);

    return panelGroup;
  }

  createBase(tableWidth) {
    return this.modelConfig.baseStyle === 'legs'
      ? this.createLegBase(tableWidth)
      : this.createPedestalBase(tableWidth);
  }

  createPedestalBase(tableWidth) {
    const m = this._materials;
    const baseGroup = new THREE.Group();

    const pedestalGeometry = new THREE.CylinderGeometry(0.25, 0.35, 0.15, 32);
    const pedestal = new THREE.Mesh(pedestalGeometry, m.stainlessSteel);
    pedestal.position.y = 0.075;
    pedestal.castShadow = true;
    pedestal.receiveShadow = true;
    baseGroup.add(pedestal);

    const columnGeometry = new THREE.CylinderGeometry(0.12, 0.18, 0.75, 32);
    const column = new THREE.Mesh(columnGeometry, m.stainlessSteel);
    column.position.y = 0.525;
    column.castShadow = true;
    baseGroup.add(column);

    const frameGeometry = new THREE.BoxGeometry(tableWidth * 0.6, 0.08, 0.7);
    const frame = new THREE.Mesh(frameGeometry, m.brushedSteel);
    frame.position.y = 0.91;
    frame.castShadow = true;
    baseGroup.add(frame);

    return baseGroup;
  }

  createLegBase(tableWidth) {
    const m = this._materials;
    const baseGroup = new THREE.Group();

    const legSize = 0.085;
    const legHeight = 0.9;
    const zDepth = 0.9;
    const legGeometry = new THREE.BoxGeometry(legSize, legHeight, legSize);

    const legPositions = [
      { x: -tableWidth / 2 + legSize / 2, z: -zDepth / 2 + legSize / 2 },
      { x: tableWidth / 2 - legSize / 2, z: -zDepth / 2 + legSize / 2 },
      { x: -tableWidth / 2 + legSize / 2, z: zDepth / 2 - legSize / 2 },
      { x: tableWidth / 2 - legSize / 2, z: zDepth / 2 - legSize / 2 }
    ];

    legPositions.forEach(({ x, z }) => {
      const leg = new THREE.Mesh(legGeometry, m.stainlessSteel);
      leg.position.set(x, legHeight / 2, z);
      leg.castShadow = true;
      leg.receiveShadow = true;
      baseGroup.add(leg);
    });

    const topFrameGeometry = new THREE.BoxGeometry(tableWidth * 0.7, 0.06, 0.75);
    const topFrame = new THREE.Mesh(topFrameGeometry, m.brushedSteel);
    topFrame.position.y = 0.91;
    topFrame.castShadow = true;
    baseGroup.add(topFrame);

    const stretcherGeometry = new THREE.BoxGeometry(tableWidth * 0.7, 0.05, 0.05);
    const frontStretcher = new THREE.Mesh(stretcherGeometry, m.brushedSteel);
    frontStretcher.position.set(0, 0.25, zDepth / 2 - 0.08);
    baseGroup.add(frontStretcher);

    const backStretcher = frontStretcher.clone();
    backStretcher.position.z = -zDepth / 2 + 0.08;
    baseGroup.add(backStretcher);

    return baseGroup;
  }

  createLedStrip(tableWidth) {
    const m = this._materials;
    const ledGroup = new THREE.Group();
    const lightStripGeometry = new THREE.BoxGeometry(tableWidth - 0.6, 0.02, 0.03);
    const lightStrip = new THREE.Mesh(lightStripGeometry, m.emissiveWhite);
    lightStrip.position.set(0, 1.78, -0.2);
    ledGroup.add(lightStrip);
    return ledGroup;
  }

  createMonitorArm() {
    const m = this._materials;
    const armGroup = new THREE.Group();

    const baseGeometry = new THREE.CylinderGeometry(0.04, 0.05, 0.08, 16);
    const base = new THREE.Mesh(baseGeometry, m.darkSteel);
    base.position.set(0, 1.95, -0.35);
    armGroup.add(base);

    const poleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 16);
    const pole = new THREE.Mesh(poleGeometry, m.darkSteel);
    pole.position.set(0, 2.15, -0.35);
    armGroup.add(pole);

    const extensionGeometry = new THREE.BoxGeometry(0.3, 0.04, 0.04);
    const extension = new THREE.Mesh(extensionGeometry, m.darkSteel);
    extension.position.set(0.15, 2.3, -0.35);
    armGroup.add(extension);

    const monitorGeometry = new THREE.BoxGeometry(0.5, 0.3, 0.02);
    const monitor = new THREE.Mesh(monitorGeometry, m.plastic);
    monitor.position.set(0.3, 2.3, -0.3);
    armGroup.add(monitor);

    const screenGeometry = new THREE.BoxGeometry(0.45, 0.25, 0.005);
    const screen = new THREE.Mesh(screenGeometry, m.mopecBlue);
    screen.position.set(0.3, 2.3, -0.28);
    armGroup.add(screen);

    return armGroup;
  }

  createMagnetBar(tableWidth) {
    const m = this._materials;
    const barGroup = new THREE.Group();

    const widthScale = this.modelConfig.width / 72;
    const barWidth = 1.5 * widthScale;

    const barGeometry = new THREE.BoxGeometry(barWidth, 0.04, 0.03);
    const bar = new THREE.Mesh(barGeometry, m.darkSteel);
    bar.position.set(0, 1.0, -0.43);
    barGroup.add(bar);
    return barGroup;
  }

  createDrawers(tableWidth) {
    const m = this._materials;
    const drawersGroup = new THREE.Group();
    const widthScale = this.modelConfig.width / 72;

    const drawerGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.5);
    const leftDrawer = new THREE.Mesh(drawerGeometry, m.stainlessSteel);
    leftDrawer.position.set(-widthScale * 0.8, 0.5, 0.1);
    leftDrawer.castShadow = true;
    drawersGroup.add(leftDrawer);

    const handleGeometry = new THREE.BoxGeometry(0.15, 0.02, 0.02);
    const leftHandle = new THREE.Mesh(handleGeometry, m.brushedSteel);
    leftHandle.position.set(-widthScale * 0.8, 0.55, 0.36);
    drawersGroup.add(leftHandle);

    const rightDrawer = leftDrawer.clone();
    rightDrawer.position.set(widthScale * 0.8, 0.5, 0.1);
    drawersGroup.add(rightDrawer);

    const rightHandle = leftHandle.clone();
    rightHandle.position.set(widthScale * 0.8, 0.55, 0.36);
    drawersGroup.add(rightHandle);

    return drawersGroup;
  }

  createPathCam() {
    const m = this._materials;
    const camGroup = new THREE.Group();

    const housingGeometry = new THREE.BoxGeometry(0.15, 0.1, 0.2);
    const housing = new THREE.Mesh(housingGeometry, m.plastic);
    housing.position.set(0, 2.1, -0.2);
    camGroup.add(housing);

    const lensGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16);
    const lens = new THREE.Mesh(lensGeometry, m.glass);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 2.08, -0.08);
    camGroup.add(lens);

    const ringGeometry = new THREE.TorusGeometry(0.05, 0.008, 8, 24);
    const ring = new THREE.Mesh(ringGeometry, m.emissiveWhite);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 2.08, -0.07);
    camGroup.add(ring);

    return camGroup;
  }

  createFormalinDispenser(tableWidth) {
    const m = this._materials;
    const position = this.modelConfig.sinkPosition;
    const wantsDualSink = this.modelConfig.hasSecondSink && this.modelConfig.width >= 96;
    const anchorPosition = wantsDualSink && position === 'center' ? 'left' : position;
    const sinkX = getSinkXForPosition(anchorPosition, tableWidth);

    const dispGroup = new THREE.Group();

    const bodyGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.18, 24);
    const body = new THREE.Mesh(bodyGeometry, m.rubber);
    body.position.set(sinkX + 0.22, 1.05, 0.22);
    dispGroup.add(body);

    const pumpGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.08, 16);
    const pump = new THREE.Mesh(pumpGeometry, m.brushedSteel);
    pump.position.set(sinkX + 0.22, 1.17, 0.22);
    dispGroup.add(pump);

    const spoutGeometry = new THREE.BoxGeometry(0.08, 0.015, 0.015);
    const spout = new THREE.Mesh(spoutGeometry, m.brushedSteel);
    spout.position.set(sinkX + 0.27, 1.19, 0.22);
    dispGroup.add(spout);

    return dispGroup;
  }

  createFrontAirSystem(tableWidth) {
    const m = this._materials;
    const fasGroup = new THREE.Group();

    const intakeGeometry = new THREE.BoxGeometry(tableWidth * 0.95, 0.035, 0.03);
    const intake = new THREE.Mesh(intakeGeometry, m.darkSteel);
    intake.position.set(0, 0.93, 0.46);
    fasGroup.add(intake);

    // Small slot pattern (instanced)
    const slotGeometry = new THREE.BoxGeometry(0.06, 0.008, 0.012);
    const slotsPerRow = Math.max(6, Math.floor((tableWidth * 0.9) / 0.08));
    const count = slotsPerRow;
    const slots = new THREE.InstancedMesh(slotGeometry, m.brushedSteel, count);
    const tmp = new THREE.Object3D();
    for (let i = 0; i < slotsPerRow; i++) {
      const t = slotsPerRow === 1 ? 0 : i / (slotsPerRow - 1);
      const x = THREE.MathUtils.lerp(-(tableWidth * 0.42), tableWidth * 0.42, t);
      tmp.position.set(x, 0.935, 0.46);
      tmp.updateMatrix();
      slots.setMatrixAt(i, tmp.matrix);
    }
    slots.instanceMatrix.needsUpdate = true;
    fasGroup.add(slots);

    return fasGroup;
  }

  createDowndraftVents(tableWidth) {
    const m = this._materials;
    const ventGroup = new THREE.Group();

    const holeGeometry = new THREE.CircleGeometry(0.012, 8);
    const rows = 2;
    const cols = Math.max(10, Math.floor((tableWidth * 0.8) / 0.08));
    const count = rows * cols;
    const holes = new THREE.InstancedMesh(holeGeometry, m.darkSteel, count);

    const tmp = new THREE.Object3D();
    tmp.rotation.x = -Math.PI / 2;
    let i = 0;
    for (let r = 0; r < rows; r++) {
      const z = 0.18 + r * 0.08;
      for (let c = 0; c < cols; c++) {
        const t = cols === 1 ? 0 : c / (cols - 1);
        const x = THREE.MathUtils.lerp(-(tableWidth * 0.35), tableWidth * 0.35, t);
        tmp.position.set(x, 0.965, z);
        tmp.updateMatrix();
        holes.setMatrixAt(i++, tmp.matrix);
      }
    }
    holes.instanceMatrix.needsUpdate = true;
    ventGroup.add(holes);

    return ventGroup;
  }

  createFormalinSensor(tableWidth) {
    const m = this._materials;
    const sensorGroup = new THREE.Group();

    const boxGeometry = new THREE.BoxGeometry(0.14, 0.08, 0.06);
    const box = new THREE.Mesh(boxGeometry, m.plastic);
    box.position.set(tableWidth / 2 - 0.25, 1.78, -0.18);
    sensorGroup.add(box);

    const ledGeometry = new THREE.SphereGeometry(0.012, 12, 12);
    const led = new THREE.Mesh(ledGeometry, m.emissiveWhite);
    led.position.set(tableWidth / 2 - 0.2, 1.78, -0.15);
    sensorGroup.add(led);

    return sensorGroup;
  }

  createHeightAdjustMechanism(tableWidth) {
    const m = this._materials;
    const mechGroup = new THREE.Group();

    // Visual cue only; actual station height is represented in UI dimensions.
    if (this.modelConfig.baseStyle === 'pedestal') {
      const sleeveGeometry = new THREE.CylinderGeometry(0.14, 0.16, 0.22, 28);
      const sleeve = new THREE.Mesh(sleeveGeometry, m.brushedSteel);
      sleeve.position.set(0, 0.72, 0);
      sleeve.castShadow = true;
      mechGroup.add(sleeve);

      const pistonGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.32, 28);
      const piston = new THREE.Mesh(pistonGeometry, m.stainlessSteel);
      piston.position.set(0, 0.92, 0);
      piston.castShadow = true;
      mechGroup.add(piston);
    } else {
      const housingGeometry = new THREE.BoxGeometry(tableWidth * 0.35, 0.14, 0.26);
      const housing = new THREE.Mesh(housingGeometry, m.darkSteel);
      housing.position.set(0, 0.55, 0);
      housing.castShadow = true;
      mechGroup.add(housing);

      const actuatorGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.4, 20);
      const actuator = new THREE.Mesh(actuatorGeometry, m.brushedSteel);
      actuator.position.set(0, 0.72, 0);
      mechGroup.add(actuator);
    }

    return mechGroup;
  }

  createRim(group, width, depth, height, yPos) {
    const rimThickness = 0.025;
    const m = this._materials;

    const frontRimGeometry = new THREE.BoxGeometry(width, height, rimThickness);
    const frontRim = new THREE.Mesh(frontRimGeometry, m.stainlessSteel);
    frontRim.position.set(0, yPos + height / 2, depth / 2);
    group.add(frontRim);

    const backRim = frontRim.clone();
    backRim.position.z = -depth / 2;
    group.add(backRim);

    const sideRimGeometry = new THREE.BoxGeometry(rimThickness, height, depth);
    const leftRim = new THREE.Mesh(sideRimGeometry, m.stainlessSteel);
    leftRim.position.set(-width / 2, yPos + height / 2, 0);
    group.add(leftRim);

    const rightRim = leftRim.clone();
    rightRim.position.x = width / 2;
    group.add(rightRim);
  }

  setView(viewName) {
    const target = VIEW_PRESETS[viewName];
    if (!target) return;

    const duration = 400;
    const start = this.camera.position.clone();
    const startTime = performance.now();

    const tick = (now) => {
      const progress = clamp((now - startTime) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.camera.position.set(
        start.x + (target.x - start.x) * eased,
        start.y + (target.y - start.y) * eased,
        start.z + (target.z - start.z) * eased
      );
      this.camera.lookAt(this.controls.target);
      this.controls.update();
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  setViewMode(mode) {
    const next = mode === 'blueprint' ? 'blueprint' : 'render';
    this.viewMode = next;
    if (next === 'blueprint') this.applyBlueprintMode();
    else this.applyRenderMode();
  }

  applyBlueprintMode() {
    if (!this.model) return;
    this.model.traverse((child) => {
      if (child.isMesh) child.material = this._blueprintMaterial;
    });
    this.renderer.setClearColor(0xffffff, 1);
  }

  applyRenderMode() {
    if (!this.model) return;
    this.model.traverse((child) => {
      if (child.isMesh && this._originalMaterials[child.uuid]) {
        child.material = this._originalMaterials[child.uuid];
      }
    });
    this.renderer.setClearColor(0x000000, 0);
  }

  zoomIn() {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    this.camera.position.copy(this.controls.target).add(offset.multiplyScalar(0.85));
    this.controls.update();
  }

  zoomOut() {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    this.camera.position.copy(this.controls.target).add(offset.multiplyScalar(1.15));
    this.controls.update();
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    return this.autoRotate;
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this._animationId = requestAnimationFrame(() => this.animate());
    if (this.autoRotate && this.model) this.model.rotation.y += 0.005;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  showLoading() {
    if (this.loadingIndicator) this.loadingIndicator.style.display = 'flex';
  }

  hideLoading() {
    if (this.loadingIndicator) this.loadingIndicator.style.display = 'none';
  }

  dispose() {
    if (this._animationId) cancelAnimationFrame(this._animationId);
    if (this._handleResize) window.removeEventListener('resize', this._handleResize);

    if (this.controls) this.controls.dispose();
    if (this.renderer) this.renderer.dispose();

    if (this.model) {
      this.scene.remove(this.model);
      this._disposeObject3D(this.model);
      this.model = null;
    }

    // Dispose managed materials created here (not shared elsewhere).
    this._blueprintMaterial.dispose();
  }
}
