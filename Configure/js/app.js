/**
 * Mopec Equipment Configurator
 * Main Application Logic
 *
 * Handles UI interactions, state management, and user events.
 */

// ============================================
// Application State
// ============================================
const AppState = {
  product: 'maestro72',
  features: ['touchscreen', 'heightAdjust', 'frontAirSystem'],
  accessories: [],
  sinkPosition: 'left',
  baseStyle: 'pedestal', // 'pedestal' | 'legs' (preview toggle)
  viewer: null,
  currentStep: 1
};

// ============================================
// DOM Elements Cache
// ============================================
const DOM = {
  // Will be populated on init
};

// ============================================
// Initialization
// ============================================
function initializeApp() {
  // Cache DOM elements
  cacheDOM();

  // Initialize UI
  initializeProductCards();
  initializeFeatureToggles();
  initializeAccessoryToggles();
  initializeSinkPositionSelector();
  initializeBaseStyleSelector();

  // Set initial state
  updateUI();
  updateStepIndicators();

  // Setup event listeners
  setupEventListeners();

  // Sync 3D model with initial state
  sync3DModel();
}

function cacheDOM() {
  DOM.productCards = document.querySelectorAll('[data-product]');
  DOM.featureToggles = document.querySelectorAll('[data-feature]');
  DOM.accessoryToggles = document.querySelectorAll('[data-accessory]');
  DOM.sinkPositionInputs = document.querySelectorAll('input[name="sinkPosition"]');
  DOM.baseStyleInputs = document.querySelectorAll('input[name="baseStyle"]');
  DOM.modelName = document.getElementById('model-name');
  DOM.dimensions = document.getElementById('dimensions');
  DOM.capacity = document.getElementById('capacity');
  DOM.material = document.getElementById('material');
  DOM.basePrice = document.getElementById('base-price');
  DOM.totalPrice = document.getElementById('total-price');
  DOM.mobileTotal = document.getElementById('mobile-total');
  DOM.modalTotal = document.getElementById('modal-total');
  DOM.summaryList = document.getElementById('summary-list');
  DOM.modalConfigSummary = document.getElementById('modal-config-summary');
  DOM.featuresCount = document.getElementById('features-count');
  DOM.accessoriesCount = document.getElementById('accessories-count');
  DOM.rotateBtn = document.getElementById('rotate-btn');
  DOM.quoteModal = document.getElementById('quote-modal');
  DOM.toastContainer = document.getElementById('toast-container');
  DOM.sinkPositionDisplay = document.getElementById('sink-position-display');
  DOM.specDimensions = document.getElementById('spec-dimensions');
  DOM.dimLength = document.getElementById('dim-length');
  DOM.dimWidth = document.getElementById('dim-width');
  DOM.dimHeight = document.getElementById('dim-height');
}

// ============================================
// Product Selection
// ============================================
function initializeProductCards() {
  DOM.productCards.forEach(card => {
    card.addEventListener('click', () => {
      const productId = card.dataset.product;
      selectProduct(productId);
    });
  });
}

function selectProduct(productId) {
  const { PRODUCTS } = window.MopecConfig;

  if (!PRODUCTS[productId]) {
    console.error(`Product ${productId} not found`);
    return;
  }

  AppState.product = productId;
  enforceProductConstraints(PRODUCTS[productId]);

  // Update card selection UI
  DOM.productCards.forEach(card => {
    const isSelected = card.dataset.product === productId;
    card.classList.toggle('selected', isSelected);
    const radio = card.querySelector('input[type="radio"]');
    if (radio) radio.checked = isSelected;
  });

  // Update model name display
  if (DOM.modelName) {
    DOM.modelName.textContent = PRODUCTS[productId].name;
  }

  // Update step indicator
  AppState.currentStep = Math.max(AppState.currentStep, 1);
  updateStepIndicators();

  updateUI();
  sync3DModel();
}

function enforceProductConstraints(product) {
  const modelWidth = product?.modelWidth ?? 72;
  const isDualUser = modelWidth >= 96;

  if (!isDualUser) {
    AppState.features = AppState.features.filter((id) => id !== 'secondSink');
  }
}

// ============================================
// Feature Toggles
// ============================================
function initializeFeatureToggles() {
  DOM.featureToggles.forEach(toggle => {
    const checkbox = toggle.querySelector('input[type="checkbox"]');
    if (checkbox) {
      // Set initial state
      const featureId = toggle.dataset.feature;
      checkbox.checked = AppState.features.includes(featureId);

      // Add change listener
      checkbox.addEventListener('change', (e) => {
        toggleFeature(featureId, e.target.checked);
      });
    }
  });
}

function toggleFeature(featureId, enabled) {
  const { FEATURES } = window.MopecConfig;

  // Don't allow toggling of included features
  if (FEATURES[featureId]?.included) {
    return;
  }

  if (featureId === 'secondSink') {
    const { PRODUCTS } = window.MopecConfig;
    const modelWidth = PRODUCTS[AppState.product]?.modelWidth ?? 72;
    if (modelWidth < 96) {
      // Safety: UI should disable this, but don't let state drift.
      return;
    }
  }

  if (enabled) {
    if (!AppState.features.includes(featureId)) {
      AppState.features.push(featureId);
    }
  } else {
    AppState.features = AppState.features.filter(id => id !== featureId);
  }

  // Update step indicator
  AppState.currentStep = Math.max(AppState.currentStep, 2);
  updateStepIndicators();

  updateUI();
  sync3DModel();
}

// ============================================
// Accessory Toggles
// ============================================
function initializeAccessoryToggles() {
  DOM.accessoryToggles.forEach(toggle => {
    const checkbox = toggle.querySelector('input[type="checkbox"]');
    if (checkbox) {
      const accessoryId = toggle.dataset.accessory;
      checkbox.checked = AppState.accessories.includes(accessoryId);

      checkbox.addEventListener('change', (e) => {
        toggleAccessory(accessoryId, e.target.checked);
      });
    }
  });
}

function toggleAccessory(accessoryId, enabled) {
  if (enabled) {
    if (!AppState.accessories.includes(accessoryId)) {
      AppState.accessories.push(accessoryId);
    }
  } else {
    AppState.accessories = AppState.accessories.filter(id => id !== accessoryId);
  }

  // Update step indicator
  AppState.currentStep = Math.max(AppState.currentStep, 4);
  updateStepIndicators();

  updateUI();
  sync3DModel();
}

// ============================================
// Sink Position Selector
// ============================================
function initializeSinkPositionSelector() {
  DOM.sinkPositionInputs.forEach(input => {
    if (input.value === AppState.sinkPosition) {
      input.checked = true;
    }

    input.addEventListener('change', (e) => {
      setSinkPosition(e.target.value);
    });
  });
}

function setSinkPosition(position) {
  AppState.sinkPosition = position;

  // Update display
  if (DOM.sinkPositionDisplay) {
    DOM.sinkPositionDisplay.textContent = position.charAt(0).toUpperCase() + position.slice(1);
  }

  // Update step indicator
  AppState.currentStep = Math.max(AppState.currentStep, 3);
  updateStepIndicators();

  updateUI();
  sync3DModel();
}

// ============================================
// Base Style Selector (Preview)
// ============================================
function initializeBaseStyleSelector() {
  if (!DOM.baseStyleInputs || DOM.baseStyleInputs.length === 0) return;

  DOM.baseStyleInputs.forEach((input) => {
    input.checked = input.value === AppState.baseStyle;
    input.addEventListener('change', () => {
      if (!input.checked) return;
      if (input.value !== 'pedestal' && input.value !== 'legs') return;
      AppState.baseStyle = input.value;
      sync3DModel();
    });
  });
}

// ============================================
// Step Indicators
// ============================================
function updateStepIndicators() {
  const steps = document.querySelectorAll('.steps .step');
  steps.forEach((step, index) => {
    const stepNum = index + 1;
    if (stepNum <= AppState.currentStep) {
      step.classList.add('step-primary');
    } else {
      step.classList.remove('step-primary');
    }
  });
}

// ============================================
// 3D Model Synchronization
// ============================================
function sync3DModel() {
  if (typeof window.update3DModel !== 'function') {
    return;
  }

  const { PRODUCTS, getModelWidth } = window.MopecConfig;
  const product = PRODUCTS[AppState.product];

  if (!product) return;

  // Build model configuration
  const modelConfig = {
    width: getModelWidth(AppState.product),
    baseStyle: AppState.baseStyle,
    sinkPosition: AppState.sinkPosition,
    hasHeightAdjust: AppState.features.includes('heightAdjust'),
    hasFrontAirSystem: AppState.features.includes('frontAirSystem'),
    hasFormalinDetection: AppState.features.includes('formalinDetection'),
    hasDowndraftVent: AppState.features.includes('downdraftVent'),
    hasDisposal: AppState.features.includes('disposal'),
    hasSecondSink: AppState.features.includes('secondSink'),
    hasPathCam: AppState.accessories.includes('pathCam'),
    hasMonitorArm: AppState.accessories.includes('monitorArm'),
    hasMagnetBar: AppState.accessories.includes('magnetBar'),
    hasDrawers: AppState.accessories.includes('drawerSystem'),
    hasLedStrip: AppState.accessories.includes('ledLightStrip'),
    hasPegboardWing: AppState.accessories.includes('pegboardWing'),
    hasFormalinDispenser: AppState.accessories.includes('formalinDispenser')
  };

  // Update 3D model
  window.update3DModel(modelConfig);

  // Update dimension annotations
  updateDimensionAnnotations(product);
}

function updateDimensionAnnotations(product) {
  if (DOM.dimLength) {
    DOM.dimLength.textContent = product.dimensions.length;
  }
  if (DOM.dimWidth) {
    DOM.dimWidth.textContent = product.dimensions.width;
  }
  if (DOM.dimHeight) {
    DOM.dimHeight.textContent = product.dimensions.heightRange;
  }
}

// ============================================
// UI Updates
// ============================================
function updateUI() {
  const { PRODUCTS, FEATURES, ACCESSORIES, formatPrice, calculateTotal, getConfigSummary } = window.MopecConfig;

  const product = PRODUCTS[AppState.product];
  if (!product) return;

  // Enforce product-specific constraints (e.g., features only available on larger models)
  enforceProductConstraints(product);

  // Update product info
  if (DOM.dimensions) {
    DOM.dimensions.textContent = `${product.dimensions.length} x ${product.dimensions.width}`;
  }
  if (DOM.capacity) {
    DOM.capacity.textContent = product.capacity;
  }
  if (DOM.material) {
    DOM.material.textContent = product.material;
  }
  if (DOM.basePrice) {
    DOM.basePrice.textContent = formatPrice(product.basePrice);
  }

  // Update sink position display
  if (DOM.sinkPositionDisplay) {
    DOM.sinkPositionDisplay.textContent = AppState.sinkPosition.charAt(0).toUpperCase() + AppState.sinkPosition.slice(1);
  }

  // Feature availability: Second sink only on 96" models
  const secondSinkToggle = Array.from(DOM.featureToggles || []).find(t => t.dataset.feature === 'secondSink');
  if (secondSinkToggle) {
    const checkbox = secondSinkToggle.querySelector('input[type="checkbox"]');
    const isDualUser = (product.modelWidth ?? 72) >= 96;
    if (checkbox) {
      checkbox.disabled = !isDualUser;
      checkbox.checked = isDualUser && AppState.features.includes('secondSink');
    }
    secondSinkToggle.classList.toggle('opacity-50', !isDualUser);
    secondSinkToggle.classList.toggle('cursor-not-allowed', !isDualUser);
    secondSinkToggle.title = isDualUser ? '' : 'Available on 96" models only';
  }

  // Update specifications panel
  if (DOM.specDimensions) {
    DOM.specDimensions.innerHTML = `
      <div class="flex justify-between"><span class="text-base-content/60">Length</span><span class="font-medium">${product.dimensions.length}</span></div>
      <div class="flex justify-between"><span class="text-base-content/60">Width</span><span class="font-medium">${product.dimensions.width}</span></div>
      <div class="flex justify-between"><span class="text-base-content/60">Height</span><span class="font-medium">${product.dimensions.heightRange}</span></div>
    `;
  }

  // Update counts
  const featuresCount = AppState.features.filter(id => !FEATURES[id]?.included).length;
  const accessoriesCount = AppState.accessories.length;

  if (DOM.featuresCount) {
    DOM.featuresCount.textContent = featuresCount;
  }
  if (DOM.accessoriesCount) {
    DOM.accessoriesCount.textContent = accessoriesCount;
  }

  // Build summary list
  updateSummaryList(product);

  // Calculate and display total
  const total = calculateTotal(AppState);
  const formattedTotal = formatPrice(total);

  if (DOM.totalPrice) DOM.totalPrice.textContent = formattedTotal;
  if (DOM.mobileTotal) DOM.mobileTotal.textContent = formattedTotal;
  if (DOM.modalTotal) DOM.modalTotal.textContent = formattedTotal;

  // Update modal summary
  if (DOM.modalConfigSummary) {
    DOM.modalConfigSummary.textContent = getConfigSummary(AppState);
  }
}

function updateSummaryList(product) {
  if (!DOM.summaryList) return;

  const { FEATURES, ACCESSORIES, formatPrice } = window.MopecConfig;

  let html = `
    <div class="flex justify-between opacity-80">
      <span>Base Unit</span>
      <span>${formatPrice(product.basePrice)}</span>
    </div>
  `;

  // Add features
  AppState.features.forEach(featureId => {
    const feature = FEATURES[featureId];
    if (feature && !feature.included) {
      html += `
        <div class="flex justify-between opacity-80">
          <span>${feature.name}</span>
          <span>${formatPrice(feature.price)}</span>
        </div>
      `;
    }
  });

  // Add accessories
  AppState.accessories.forEach(accessoryId => {
    const accessory = ACCESSORIES[accessoryId];
    if (accessory) {
      html += `
        <div class="flex justify-between opacity-80">
          <span>${accessory.name}</span>
          <span>${formatPrice(accessory.price)}</span>
        </div>
      `;
    }
  });

  DOM.summaryList.innerHTML = html;
}

// ============================================
// Event Listeners
// ============================================
function setupEventListeners() {
  // Accordion change events for step tracking
  document.querySelectorAll('.collapse input[type="radio"]').forEach((input, index) => {
    input.addEventListener('change', () => {
      if (input.checked) {
        AppState.currentStep = Math.max(AppState.currentStep, index + 1);
        updateStepIndicators();
      }
    });
  });
}

// ============================================
// Global Functions (for inline handlers)
// ============================================
window.resetConfiguration = function() {
  const { DEFAULT_CONFIG, PRODUCTS } = window.MopecConfig;

  AppState.product = DEFAULT_CONFIG.product;
  AppState.features = [...DEFAULT_CONFIG.features];
  AppState.accessories = [...DEFAULT_CONFIG.accessories];
  AppState.sinkPosition = DEFAULT_CONFIG.sinkPosition;
  AppState.baseStyle = DEFAULT_CONFIG.baseStyle || 'pedestal';
  AppState.currentStep = 1;

  // Reset product cards
  DOM.productCards.forEach(card => {
    const isDefault = card.dataset.product === DEFAULT_CONFIG.product;
    card.classList.toggle('selected', isDefault);
    const radio = card.querySelector('input[type="radio"]');
    if (radio) radio.checked = isDefault;
  });

  // Reset feature checkboxes
  DOM.featureToggles.forEach(toggle => {
    const featureId = toggle.dataset.feature;
    const checkbox = toggle.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.disabled) {
      checkbox.checked = DEFAULT_CONFIG.features.includes(featureId);
    }
  });

  // Reset accessory checkboxes
  DOM.accessoryToggles.forEach(toggle => {
    const checkbox = toggle.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.checked = false;
  });

  // Reset sink position
  DOM.sinkPositionInputs.forEach(input => {
    input.checked = input.value === DEFAULT_CONFIG.sinkPosition;
  });

  // Reset base style preview
  if (DOM.baseStyleInputs) {
    DOM.baseStyleInputs.forEach(input => {
      input.checked = input.value === AppState.baseStyle;
    });
  }

  // Update model name
  if (DOM.modelName) {
    DOM.modelName.textContent = PRODUCTS[DEFAULT_CONFIG.product].name;
  }

  updateUI();
  updateStepIndicators();
  sync3DModel();
  showToast('Configuration reset to default', 'info');
};

window.requestQuote = function() {
  // Mark step 5 as complete when requesting quote
  AppState.currentStep = 5;
  updateStepIndicators();

  if (DOM.quoteModal) {
    DOM.quoteModal.showModal();
  }
};

window.submitQuote = function(event) {
  event.preventDefault();

  if (DOM.quoteModal) {
    DOM.quoteModal.close();
  }

  showToast('Quote request submitted! Our team will contact you within 24 hours.', 'success');
};

// ============================================
// Toast Notifications
// ============================================
function showToast(message, type = 'info') {
  if (!DOM.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = `alert alert-${type} shadow-lg animate-fade-in`;

  const iconPath = type === 'success'
    ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
    : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

  toast.innerHTML = `
    <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${iconPath}"></path>
    </svg>
    <span class="text-sm">${message}</span>
  `;

  DOM.toastContainer.appendChild(toast);

  // Auto-remove after delay
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ============================================
// Initialize on DOM Ready
// ============================================
document.addEventListener('DOMContentLoaded', initializeApp);

// Export for debugging
window.AppState = AppState;
window.showToast = showToast;
