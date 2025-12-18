/**
 * Mopec Equipment Configurator
 * Configuration Data & Pricing
 *
 * This file contains all product data, pricing, and configuration options
 * for the Mopec Maestro Grossing Station configurator.
 */

// ============================================
// Product Catalog
// ============================================
const PRODUCTS = {
  maestro48: {
    id: 'maestro48',
    name: 'Mopec Maestro 48"',
    subtitle: 'Compact Grossing Station',
    basePrice: 12500,
    dimensions: {
      length: '48"',
      width: '32"',
      heightRange: '34.5" - 46.5"',
      sinkSize: '18" x 10" x 6"'
    },
    capacity: '500 lbs',
    material: '304 Stainless Steel',
    finish: 'No. 4 Satin Finish',
    description: 'Compact Maestro ideal for smaller spaces and laboratories.',
    popular: false,
    modelWidth: 48
  },
  maestro60: {
    id: 'maestro60',
    name: 'Mopec Maestro 60"',
    subtitle: 'Standard Grossing Station',
    basePrice: 14500,
    dimensions: {
      length: '60"',
      width: '32"',
      heightRange: '34.5" - 46.5"',
      sinkSize: '20" x 12" x 8"'
    },
    capacity: '750 lbs',
    material: '304 Stainless Steel',
    finish: 'No. 4 Satin Finish',
    description: 'Entry-level Maestro with full ventilation system and ergonomic design.',
    popular: false,
    modelWidth: 60
  },
  maestro72: {
    id: 'maestro72',
    name: 'Mopec Maestro 72"',
    subtitle: 'Enhanced Grossing Station',
    basePrice: 17500,
    dimensions: {
      length: '72"',
      width: '32"',
      heightRange: '34.5" - 46.5"',
      sinkSize: '20" x 12" x 8"'
    },
    capacity: '750 lbs',
    material: '304 Stainless Steel',
    finish: 'No. 4 Satin Finish',
    description: 'Extended work surface for larger specimens with premium ventilation.',
    popular: true,
    modelWidth: 72
  },
  maestro96: {
    id: 'maestro96',
    name: 'Mopec Maestro 96"',
    subtitle: 'Dual-User Grossing Station',
    basePrice: 24500,
    dimensions: {
      length: '96"',
      width: '32"',
      heightRange: '34.5" - 46.5"',
      sinkSize: '24" x 14" x 10"'
    },
    capacity: '1200 lbs',
    material: '304 Stainless Steel',
    finish: 'No. 4 Satin Finish',
    description: 'Maximum workspace with enhanced sink and dual user capability.',
    popular: false,
    isNew: true,
    modelWidth: 96
  }
};

// ============================================
// Feature Options
// ============================================
const FEATURES = {
  heightAdjust: {
    id: 'heightAdjust',
    name: 'Hydraulic Elevation',
    description: 'ADA compliant, adjusts 34.5" to 46.5" via touchscreen',
    price: 2400,
    icon: 'height'
  },
  frontAirSystem: {
    id: 'frontAirSystem',
    name: 'Front Air System (FAS)',
    description: 'Patent pending on-demand laminar flow protection',
    price: 3200,
    icon: 'air'
  },
  formalinDetection: {
    id: 'formalinDetection',
    name: 'Formalin Fume Detection',
    description: 'Real-time monitoring with adjustable threshold alerts',
    price: 1800,
    icon: 'sensor'
  },
  downdraftVent: {
    id: 'downdraftVent',
    name: 'Downdraft Ventilation',
    description: '275-400 CFM exhaust with dual 8" duct stubs',
    price: 2800,
    icon: 'vent'
  },
  touchscreen: {
    id: 'touchscreen',
    name: 'Touchscreen Control Panel',
    description: 'Easy-to-use interface with user profile storage',
    price: 1200,
    icon: 'display',
    included: true
  },
  disposal: {
    id: 'disposal',
    name: 'Waste Disposal Unit',
    description: 'Heavy duty 1/2 HP garbage disposal',
    price: 950,
    icon: 'disposal'
  },
  secondSink: {
    id: 'secondSink',
    name: 'Second Sink',
    description: 'Additional sink for 96" models',
    price: 1200,
    icon: 'sink'
  }
};

// ============================================
// Accessory Options
// ============================================
const ACCESSORIES = {
  pathCam: {
    id: 'pathCam',
    name: 'PathCam Imaging System',
    sku: 'PC-100',
    description: 'High-resolution specimen imaging with stereoscopic viewing',
    price: 8500,
    category: 'imaging',
    premium: true
  },
  monitorArm: {
    id: 'monitorArm',
    name: 'Monitor Arm',
    sku: 'MAS-MM01',
    description: 'Ergonomic center-mounted adjustable monitor arm',
    price: 340,
    category: 'technology'
  },
  magnetBar: {
    id: 'magnetBar',
    name: 'Magnetic Instrument Bar',
    sku: 'MAS-MB01',
    description: 'Tool organization magnetic strip',
    price: 185,
    category: 'organization'
  },
  drawerSystem: {
    id: 'drawerSystem',
    name: 'Under-Counter Drawers',
    sku: 'MAS-SD01',
    description: 'Stainless steel storage drawers',
    price: 550,
    category: 'storage'
  },
  ledLightStrip: {
    id: 'ledLightStrip',
    name: 'LED Light Strip',
    sku: 'MAS-LS01',
    description: 'Bright 5000K illumination for photography and examination',
    price: 425,
    category: 'lighting'
  },
  pegboardWing: {
    id: 'pegboardWing',
    name: 'Pegboard Wing Extension',
    sku: 'MAS-PW01',
    description: 'Additional pegboard for expanded accessory mounting',
    price: 485,
    category: 'organization'
  },
  formalinDispenser: {
    id: 'formalinDispenser',
    name: 'Formalin Dispenser',
    sku: 'MAS-FD01',
    description: 'Spatter-free controlled formalin dispensing system',
    price: 620,
    category: 'dispensing'
  },
  cassetteShelf: {
    id: 'cassetteShelf',
    name: 'Cassette Labeling Shelf',
    sku: 'MAS-CS01',
    description: 'Dedicated shelf for cassette labeling work',
    price: 195,
    category: 'organization'
  },
  ventilatedTrash: {
    id: 'ventilatedTrash',
    name: 'Ventilated Trash System',
    sku: 'MAS-VT01',
    description: 'Integrated ventilated waste receptacle',
    price: 385,
    category: 'waste'
  },
  keyboardTray: {
    id: 'keyboardTray',
    name: 'Keyboard Tray Insert',
    sku: 'MAS-KT01',
    description: 'Pull-out keyboard and mouse tray',
    price: 275,
    category: 'technology'
  },
  splashShield: {
    id: 'splashShield',
    name: 'Safety Splash Shield',
    sku: 'MAS-SS01',
    description: 'Clear protective shield for enhanced safety',
    price: 285,
    category: 'safety'
  }
};

// ============================================
// Sink Position Options
// ============================================
const SINK_POSITIONS = {
  left: {
    id: 'left',
    name: 'Left',
    description: 'Sink positioned on the left side of the station'
  },
  center: {
    id: 'center',
    name: 'Center',
    description: 'Sink positioned in the center of the station'
  },
  right: {
    id: 'right',
    name: 'Right',
    description: 'Sink positioned on the right side of the station'
  },
  none: {
    id: 'none',
    name: 'No Sink',
    description: 'Station without sink (work surface only)'
  }
};

// ============================================
// Technical Specifications
// ============================================
const SPECIFICATIONS = {
  construction: {
    title: 'Construction',
    color: 'blue',
    items: [
      { label: 'Material', value: '304 Stainless Steel' },
      { label: 'Finish', value: 'No. 4 Satin' },
      { label: 'Welds', value: 'Heliarc (TIG)' },
      { label: 'Sink', value: '16 Gauge SS' }
    ]
  },
  electrical: {
    title: 'Electrical',
    color: 'orange',
    items: [
      { label: 'Power', value: '115V/60Hz/1Ph' },
      { label: 'Circuits', value: '2 x 20A Dedicated' },
      { label: 'Outlets', value: '4 GFCI w/ USB' },
      { label: 'Lighting', value: 'LED, 5000K' }
    ]
  },
  ventilation: {
    title: 'Ventilation',
    color: 'green',
    items: [
      { label: 'Exhaust', value: '275-400 CFM' },
      { label: 'Ducts', value: 'Dual 8" Stubs' },
      { label: 'FAS', value: 'On-Demand' },
      { label: 'Monitoring', value: 'Real-time' }
    ]
  }
};

// ============================================
// Default Configuration
// ============================================
const DEFAULT_CONFIG = {
  product: 'maestro72',
  features: ['touchscreen', 'heightAdjust', 'frontAirSystem'],
  accessories: [],
  sinkPosition: 'left',
  baseStyle: 'pedestal'
};

// ============================================
// Utility Functions
// ============================================

/**
 * Format price as USD currency string
 * @param {number} price - Price in dollars
 * @returns {string} Formatted price string
 */
function formatPrice(price) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price);
}

/**
 * Calculate total configuration price
 * @param {Object} config - Current configuration state
 * @returns {number} Total price
 */
function calculateTotal(config) {
  let total = 0;

  // Add base product price
  if (config.product && PRODUCTS[config.product]) {
    total += PRODUCTS[config.product].basePrice;
  }

  // Add feature prices
  if (config.features && Array.isArray(config.features)) {
    config.features.forEach(featureId => {
      if (FEATURES[featureId] && !FEATURES[featureId].included) {
        total += FEATURES[featureId].price;
      }
    });
  }

  // Add accessory prices
  if (config.accessories && Array.isArray(config.accessories)) {
    config.accessories.forEach(accessoryId => {
      if (ACCESSORIES[accessoryId]) {
        total += ACCESSORIES[accessoryId].price;
      }
    });
  }

  return total;
}

/**
 * Generate configuration summary text
 * @param {Object} config - Current configuration state
 * @returns {string} Summary text
 */
function getConfigSummary(config) {
  const parts = [];

  if (config.product && PRODUCTS[config.product]) {
    parts.push(PRODUCTS[config.product].name);
  }

  const featureNames = config.features
    .filter(id => FEATURES[id] && !FEATURES[id].included)
    .map(id => FEATURES[id].name);

  if (featureNames.length > 0) {
    parts.push('with ' + featureNames.join(', '));
  }

  const accessoryCount = config.accessories.length;
  if (accessoryCount > 0) {
    parts.push(`+ ${accessoryCount} accessor${accessoryCount === 1 ? 'y' : 'ies'}`);
  }

  return parts.join(' ');
}

/**
 * Get model width from product ID
 * @param {string} productId - Product ID
 * @returns {number} Model width in inches
 */
function getModelWidth(productId) {
  if (PRODUCTS[productId]) {
    return PRODUCTS[productId].modelWidth || 72;
  }
  return 72;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.MopecConfig = {
    PRODUCTS,
    FEATURES,
    ACCESSORIES,
    SINK_POSITIONS,
    SPECIFICATIONS,
    DEFAULT_CONFIG,
    formatPrice,
    calculateTotal,
    getConfigSummary,
    getModelWidth
  };
}
