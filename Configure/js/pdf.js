/**
 * Mopec Equipment Configurator
 * PDF generation (jsPDF + AutoTable)
 *
 * Exposes `window.downloadPDF()` for UI buttons.
 */

function loadImageAsPngDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function safeString(value) {
  return typeof value === 'string' ? value : '';
}

function titleCase(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateStamp(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function tryGetViewerSnapshotPng() {
  const canvas = document.getElementById('three-canvas');
  if (!canvas || typeof canvas.toDataURL !== 'function') return null;
  try {
    // WebGL canvas may throw if tainted. We catch and fall back to a no-snapshot PDF.
    return canvas.toDataURL('image/png', 0.92);
  } catch {
    return null;
  }
}

function drawKeyValue(doc, x, y, key, value, { keyColor, valueColor, keyWidth = 28 } = {}) {
  doc.setTextColor(...keyColor);
  doc.setFont('helvetica', 'bold');
  doc.text(`${key}:`, x, y);

  doc.setTextColor(...valueColor);
  doc.setFont('helvetica', 'normal');
  doc.text(String(value), x + keyWidth, y);
}

window.downloadPDF = async function downloadPDF() {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF || !window.MopecConfig || !window.AppState) return;

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const { PRODUCTS, FEATURES, ACCESSORIES, formatPrice, calculateTotal } = window.MopecConfig;
  const state = window.AppState;
  const product = PRODUCTS[state.product];
  if (!product) return;

  // Brand colors (RGB) from css/styles.css
  const mopecBlue = [64, 126, 201];
  const mopecGray = [75, 79, 84];
  const mopecGreen = [101, 141, 27];
  const mopecLight = [241, 245, 249];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Header band
  doc.setFillColor(...mopecBlue);
  doc.rect(0, 0, pageW, 30, 'F');

  // Logo
  try {
    let logoDataUrl;
    try {
      logoDataUrl = await loadImageAsPngDataUrl('logo.png');
    } catch {
      // Fallback to the header logo source (WebP) converted to PNG via canvas.
      logoDataUrl = await loadImageAsPngDataUrl('mopec-logo-400x128.webp');
    }
    const logoWidth = 40;
    const logoHeight = 12.8;
    doc.addImage(logoDataUrl, 'PNG', margin, 8, logoWidth, logoHeight);
  } catch (err) {
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('MOPEC', margin, 18);
  }

  // Header text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Configuration Quote', pageW - margin, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(new Date().toLocaleDateString(), pageW - margin, 23, { align: 'right' });

  // Title + meta
  doc.setTextColor(...mopecGray);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(product.name, margin, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const baseStyleLabel = state.baseStyle === 'legs' ? '4-leg frame' : 'Center pedestal';
  const sinkLabel = titleCase(safeString(state.sinkPosition));
  const configId = `${safeString(product.id || 'maestro').toUpperCase()} • ${formatDateStamp()}`;

  doc.setFontSize(10);
  doc.setTextColor(...mopecGray);
  doc.text(configId, margin, 51);

  // Summary cards area
  const snapshot = tryGetViewerSnapshotPng();
  const cardY = 56;
  const cardH = 40;
  const leftW = snapshot ? 108 : pageW - margin * 2;
  const rightW = snapshot ? (pageW - margin * 2 - leftW - 6) : 0;

  // Left card: configuration highlights
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(...mopecLight);
  doc.roundedRect(margin, cardY, leftW, cardH, 3, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...mopecGray);
  doc.text('Configuration', margin + 4, cardY + 8);

  drawKeyValue(doc, margin + 4, cardY + 16, 'Base', baseStyleLabel, {
    keyColor: mopecGray,
    valueColor: mopecGray
  });
  drawKeyValue(doc, margin + 4, cardY + 22, 'Sink', sinkLabel, {
    keyColor: mopecGray,
    valueColor: mopecGray
  });
  drawKeyValue(doc, margin + 4, cardY + 28, 'Dimensions', `${product.dimensions.length} × ${product.dimensions.width}`, {
    keyColor: mopecGray,
    valueColor: mopecGray
  });
  drawKeyValue(doc, margin + 4, cardY + 34, 'Height', product.dimensions.heightRange, {
    keyColor: mopecGray,
    valueColor: mopecGray
  });

  // Right card: pricing summary
  const total = calculateTotal(state);
  const includedCount = (state.features || []).filter((id) => FEATURES[id]?.included).length;
  const paidFeatures = (state.features || []).filter((id) => FEATURES[id] && !FEATURES[id].included);
  const accessories = state.accessories || [];
  const paidFeaturesTotal = paidFeatures.reduce((sum, id) => sum + (FEATURES[id]?.price || 0), 0);
  const accessoriesTotal = accessories.reduce((sum, id) => sum + (ACCESSORIES[id]?.price || 0), 0);

  if (snapshot) {
    doc.setFillColor(...mopecLight);
    doc.roundedRect(margin + leftW + 6, cardY, rightW, cardH, 3, 3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...mopecGray);
    doc.text('Pricing', margin + leftW + 10, cardY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    drawKeyValue(doc, margin + leftW + 10, cardY + 16, 'Base', formatPrice(product.basePrice), {
      keyColor: mopecGray,
      valueColor: mopecGray,
      keyWidth: 22
    });
    drawKeyValue(doc, margin + leftW + 10, cardY + 22, 'Options', formatPrice(paidFeaturesTotal), {
      keyColor: mopecGray,
      valueColor: mopecGray,
      keyWidth: 22
    });
    drawKeyValue(doc, margin + leftW + 10, cardY + 28, 'Accessories', formatPrice(accessoriesTotal), {
      keyColor: mopecGray,
      valueColor: mopecGray,
      keyWidth: 22
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...mopecGreen);
    doc.text(formatPrice(total), margin + leftW + 10, cardY + 38);
  }

  // Snapshot (top-right)
  let afterCardsY = cardY + cardH + 8;
  if (snapshot) {
    const shotW = rightW;
    const shotH = 32;
    const shotX = margin + leftW + 6;
    const shotY = cardY + cardH + 8;
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(shotX, shotY, shotW, shotH, 3, 3, 'S');
    try {
      doc.addImage(snapshot, 'PNG', shotX + 1, shotY + 1, shotW - 2, shotH - 2);
    } catch {
      // Ignore snapshot failures; the rest of the PDF still renders.
    }
    afterCardsY = shotY + shotH + 8;
  }

  // Build table rows with sections for readability.
  const rows = [];
  rows.push({ isSection: true, item: 'Base Unit', details: '', price: '' });
  rows.push({
    item: product.name,
    details: safeString(product.subtitle),
    price: formatPrice(product.basePrice)
  });

  rows.push({ isSection: true, item: 'Options', details: `${paidFeatures.length} selected • ${includedCount} included`, price: '' });
  (state.features || []).forEach((id) => {
    const feature = FEATURES[id];
    if (!feature) return;
    if (feature.included) {
      rows.push({ item: feature.name, details: 'Included', price: 'Included' });
      return;
    }
    rows.push({
      item: feature.name,
      details: safeString(feature.description),
      price: formatPrice(feature.price)
    });
  });

  rows.push({ isSection: true, item: 'Accessories', details: `${accessories.length} selected`, price: '' });
  accessories.forEach((id) => {
    const accessory = ACCESSORIES[id];
    if (!accessory) return;
    rows.push({
      item: accessory.name,
      details: accessory.sku ? `SKU: ${accessory.sku}` : safeString(accessory.description),
      price: formatPrice(accessory.price)
    });
  });

  rows.push({ isTotal: true, item: 'TOTAL ESTIMATE', details: 'Excludes shipping & tax', price: formatPrice(total) });

  doc.autoTable({
    startY: afterCardsY,
    columns: [
      { header: 'Item', dataKey: 'item' },
      { header: 'Details', dataKey: 'details' },
      { header: 'Price', dataKey: 'price' }
    ],
    body: rows,
    theme: 'striped',
    headStyles: { fillColor: mopecBlue, textColor: 255, fontStyle: 'bold' },
    columnStyles: { price: { halign: 'right', fontStyle: 'bold' } },
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.2, textColor: mopecGray },
    didParseCell(data) {
      const raw = data.row.raw || {};
      if (raw.isSection) {
        data.cell.styles.fillColor = mopecLight;
        data.cell.styles.textColor = mopecGray;
        data.cell.styles.fontStyle = 'bold';
        if (data.column.dataKey === 'price') {
          data.cell.text = [''];
        }
      }
      if (raw.isTotal) {
        data.cell.styles.fillColor = mopecBlue;
        data.cell.styles.textColor = 255;
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.column.dataKey === 'price' && data.cell.raw === 'Included') {
        data.cell.styles.textColor = mopecGray;
        data.cell.styles.fontStyle = 'normal';
      }
    },
    didDrawPage(data) {
      // Footer on every page.
      doc.setFontSize(8);
      doc.setTextColor(...mopecGray);
      doc.text('Mopec • Better By Design', margin, pageH - 8);
      doc.text(`Page ${data.pageNumber}`, pageW - margin, pageH - 8, { align: 'right' });
    }
  });

  const finalY = (doc.lastAutoTable?.finalY || 68) + 12;
  doc.setTextColor(...mopecGray);
  doc.setFontSize(9);
  doc.text('Notes', margin, finalY);
  doc.setFontSize(8.8);
  doc.setTextColor(...mopecGray);
  doc.text('• This is an estimated quote generated by the online configurator.', margin, finalY + 5);
  doc.text('• Shipping and taxes are not included.', margin, finalY + 10);
  doc.text('• Contact sales@mopec.com for a formal quote and lead time confirmation.', margin, finalY + 15);

  const safeModel = safeString(product.id || 'maestro');
  const stamp = formatDateStamp();
  doc.save(`Mopec_${safeModel}_${stamp}.pdf`);
};
