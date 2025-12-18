/**
 * Mopec Equipment Configurator
 * Viewer Runtime Bridge
 *
 * Wires the DOM (index.html controls) to the procedural Three.js viewer module.
 * Exposes a small set of global functions used by inline handlers.
 */

import { MopecViewer } from './viewer.js';

function getRequiredElement(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element: #${id}`);
  return el;
}

function setActiveWithin(selector, activeEl) {
  document.querySelectorAll(selector).forEach((el) => el.classList.toggle('active', el === activeEl));
}

const container = getRequiredElement('canvas-container');
const canvas = getRequiredElement('three-canvas');
const loadingIndicator = document.getElementById('loading-indicator');
const dimensionOverlay = document.getElementById('dimension-annotations');
const rotateBtn = document.getElementById('rotate-btn');

const viewer = new MopecViewer({
  container,
  canvas,
  loadingIndicator
});

// Match the default active state in the UI ("Front" + "Render").
viewer.setView('front');
viewer.setViewMode('render');

// ---- Global API (used by inline handlers) ----
window.update3DModel = function update3DModel(partialConfig) {
  viewer.update(partialConfig);
};

window.setView = function setView(viewName, btn) {
  viewer.setView(viewName);
  if (btn) setActiveWithin('[data-view]', btn);
};

window.setViewMode = function setViewMode(mode) {
  viewer.setViewMode(mode);

  const isBlueprint = mode === 'blueprint';
  const renderBtn = document.getElementById('view-render');
  const blueprintBtn = document.getElementById('view-blueprint');
  if (renderBtn) renderBtn.classList.toggle('active', !isBlueprint);
  if (blueprintBtn) blueprintBtn.classList.toggle('active', isBlueprint);

  if (dimensionOverlay) dimensionOverlay.classList.toggle('hidden', !isBlueprint);
};

window.zoomIn = function zoomIn() {
  viewer.zoomIn();
};

window.zoomOut = function zoomOut() {
  viewer.zoomOut();
};

window.toggleAutoRotate = function toggleAutoRotate() {
  const enabled = viewer.toggleAutoRotate();
  if (rotateBtn) rotateBtn.classList.toggle('active', enabled);
};

// Expose for debugging in the browser console.
window.__mopecViewer = viewer;

