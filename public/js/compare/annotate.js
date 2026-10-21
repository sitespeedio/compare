/* exported addDrawingLayer, setDrawTool, undoDrawing, clearDrawings, saveDrawingPng */

// Lines, circles and text drawn on the waterfalls. A shape keeps its
// position in milliseconds (x) and waterfall rows (y), so it stays on
// the same request when the waterfall is drawn again at another width.
const drawing = {
  tool: null,
  layers: {},
  // {key, undo} for each change, so Undo also reverts moves and Clear.
  history: []
};
// Where each text was drawn, to find it under the pointer.
const textBoxes = new WeakMap();

/**
 * @param {string} key 'har1' or 'har2'
 * @param {Object} renderer the waterfall-tools renderer
 * @param {HTMLElement} container holds the waterfall canvas
 * @param {Array} shapes the shapes of this run, changed in place
 */
function addDrawingLayer(key, renderer, container, shapes) {
  const base = container.querySelector('canvas');
  if (!base) return;
  const overlay = document.createElement('canvas');
  overlay.className = 'wf-draw';
  container.appendChild(overlay);
  const layer = { key, renderer, container, base, overlay, shapes, draft: null };
  drawing.layers[key] = layer;
  drawing.history = drawing.history.filter(h => h.key !== key);

  overlay.addEventListener('pointerdown', e => startShape(layer, e));
  overlay.addEventListener('pointermove', e => {
    if (layer.moving) moveShape(layer, pointAt(layer, e));
    else if (layer.draft) {
      layer.draft.b = pointAt(layer, e);
      redraw(layer);
    } else if (drawing.tool && dimensions(layer)) {
      overlay.style.cursor = shapeAt(layer, pointAt(layer, e)) ? 'move' : '';
    }
  });
  overlay.addEventListener('pointerup', () => {
    if (!layer.moving) {
      endShape(layer);
      return;
    }
    // A click without a drag moved nothing, so there is nothing to undo.
    if (layer.moving.shape.a === layer.moving.a) drawing.history.pop();
    layer.moving = null;
  });
  overlay.addEventListener('pointercancel', () => {
    layer.draft = null;
    layer.moving = null;
    redraw(layer);
  });
  // waterfall-tools sets the canvas size after the container changes.
  const resize = new ResizeObserver(() => redraw(layer));
  resize.observe(container);
  resize.observe(base);
  redraw(layer);
}

function dimensions(layer) {
  const rows = layer.renderer && layer.renderer.drawnRows;
  return rows && rows.dimensions && rows.dimensions.canvasWidth ? rows.dimensions : null;
}

// Screen pixels per waterfall pixel.
function scaleOf(layer, dims) {
  return layer.base.clientWidth / dims.canvasWidth;
}

function pointAt(layer, e) {
  const dims = dimensions(layer);
  const r = layer.base.getBoundingClientRect();
  const s = scaleOf(layer, dims);
  return {
    ms: ((e.clientX - r.left) / s - dims.labelsWidth) / dims.widthPerMs,
    y: (e.clientY - r.top) / s
  };
}

function startShape(layer, e) {
  if (!drawing.tool || !dimensions(layer)) return;
  e.preventDefault();
  const p = pointAt(layer, e);
  const shape = shapeAt(layer, p);
  if (shape) {
    layer.overlay.setPointerCapture(e.pointerId);
    startMove(layer, shape, p);
    return;
  }
  if (drawing.tool === 'text') {
    askText(layer, p, e);
    return;
  }
  layer.overlay.setPointerCapture(e.pointerId);
  layer.draft = { type: drawing.tool, a: p, b: p };
}

function xOf(dims, p) {
  return dims.labelsWidth + p.ms * dims.widthPerMs;
}

// The top shape whose line, outline or text is under the point.
function shapeAt(layer, p) {
  const dims = dimensions(layer);
  const px = xOf(dims, p);
  const near = 6;
  for (let i = layer.shapes.length - 1; i >= 0; i--) {
    const shape = layer.shapes[i];
    const ax = xOf(dims, shape.a);
    const ay = shape.a.y;
    const bx = xOf(dims, shape.b);
    const by = shape.b.y;
    if (shape.type === 'line') {
      const length = Math.hypot(bx - ax, by - ay) || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (p.y - ay) * (by - ay)) / (length * length)));
      if (Math.hypot(px - (ax + t * (bx - ax)), p.y - (ay + t * (by - ay))) <= near) return shape;
    } else if (shape.type === 'circle') {
      const rx = Math.max(Math.abs(bx - ax) / 2, 3);
      const ry = Math.max(Math.abs(by - ay) / 2, 3);
      const d = Math.hypot((px - (ax + bx) / 2) / rx, (p.y - (ay + by) / 2) / ry);
      if (Math.abs(d - 1) * Math.min(rx, ry) <= near) return shape;
    } else if (shape.type === 'text') {
      const box = textBoxes.get(shape);
      if (box && px >= box.x - 4 && px <= box.x + box.width + 4 && Math.abs(p.y - ay) <= 10) return shape;
    }
  }
  return null;
}

function startMove(layer, shape, p) {
  const a = shape.a;
  const b = shape.b;
  layer.moving = { shape, from: p, a, b };
  drawing.history.push({
    key: layer.key,
    undo: () => {
      shape.a = a;
      shape.b = b;
    }
  });
}

function moveShape(layer, p) {
  const { shape, from, a, b } = layer.moving;
  const dms = p.ms - from.ms;
  const dy = p.y - from.y;
  shape.a = { ms: a.ms + dms, y: a.y + dy };
  shape.b = { ms: b.ms + dms, y: b.y + dy };
  redraw(layer);
}

function endShape(layer) {
  const shape = layer.draft;
  layer.draft = null;
  if (!shape) return;
  const dims = dimensions(layer);
  const dx = (shape.b.ms - shape.a.ms) * dims.widthPerMs;
  const dy = shape.b.y - shape.a.y;
  // A click without a drag is not a shape.
  if (Math.hypot(dx, dy) >= 6) addShape(layer, shape);
  redraw(layer);
}

function addShape(layer, shape) {
  layer.shapes.push(shape);
  drawing.history.push({
    key: layer.key,
    undo: () => layer.shapes.splice(layer.shapes.indexOf(shape), 1)
  });
  redraw(layer);
}

// Show a text field where the user clicked. Enter adds the text, Esc
// or an empty field cancels it.
function askText(layer, p, e) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'wf-draw-input';
  input.setAttribute('aria-label', 'Text to add to the waterfall');
  const r = layer.container.getBoundingClientRect();
  input.style.left = (e.clientX - r.left) + 'px';
  input.style.top = (e.clientY - r.top) + 'px';
  layer.container.appendChild(input);
  let done = false;
  const finish = keep => {
    if (done) return;
    done = true;
    const text = input.value.trim();
    input.remove();
    if (keep && text) addShape(layer, { type: 'text', a: p, b: p, text });
  };
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') finish(true);
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  // Focus after this pointer event, else the canvas takes the focus back.
  setTimeout(() => input.focus(), 0);
}

function redraw(layer) {
  const dims = dimensions(layer);
  const { base, overlay } = layer;
  if (!dims || !base.isConnected) return;
  const ratio = window.devicePixelRatio || 1;
  overlay.style.left = base.offsetLeft + 'px';
  overlay.style.top = base.offsetTop + 'px';
  overlay.style.width = base.clientWidth + 'px';
  overlay.style.height = base.clientHeight + 'px';
  overlay.width = Math.round(base.clientWidth * ratio);
  overlay.height = Math.round(base.clientHeight * ratio);
  const ctx = overlay.getContext('2d');
  const s = scaleOf(layer, dims) * ratio;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  drawShapes(ctx, dims, layer.draft ? layer.shapes.concat(layer.draft) : layer.shapes);
}

// Draw in waterfall pixels. The caller sets the scale.
function drawShapes(ctx, dims, shapes) {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--color-draw').trim() || '#dc2626';
  const x = p => xOf(dims, p);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const shape of shapes) {
    const ax = x(shape.a);
    const ay = shape.a.y;
    const bx = x(shape.b);
    const by = shape.b.y;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (shape.type === 'line') {
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      // Arrow head at the end of the line.
      const angle = Math.atan2(by - ay, bx - ax);
      for (const side of [-1, 1]) {
        ctx.moveTo(bx, by);
        ctx.lineTo(bx - 11 * Math.cos(angle + side * 0.45), by - 11 * Math.sin(angle + side * 0.45));
      }
      ctx.stroke();
    } else if (shape.type === 'circle') {
      ctx.ellipse((ax + bx) / 2, (ay + by) / 2, Math.max(Math.abs(bx - ax) / 2, 3), Math.max(Math.abs(by - ay) / 2, 3), 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === 'text') {
      ctx.font = '600 14px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.textBaseline = 'middle';
      // A white outline keeps the text readable on the bars.
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#ffffff';
      // Keep the text inside the waterfall when the time axis gets narrower.
      const width = ctx.measureText(shape.text).width;
      const tx = Math.max(0, Math.min(ax, dims.canvasWidth - width - 4));
      textBoxes.set(shape, { x: tx, width });
      ctx.strokeText(shape.text, tx, ay);
      ctx.fillText(shape.text, tx, ay);
    }
  }
}

function setDrawTool(tool) {
  drawing.tool = drawing.tool === tool || !tool ? null : tool;
  for (const button of document.querySelectorAll('[data-action="draw-tool"]')) {
    button.setAttribute('aria-pressed', String(button.dataset.tool === drawing.tool));
  }
  const wrapper = document.querySelector('.harwrapper');
  if (wrapper) {
    wrapper.classList.toggle('is-drawing', !!drawing.tool);
    wrapper.classList.toggle('is-drawing-text', drawing.tool === 'text');
  }
  const hint = document.getElementById('drawHint');
  if (hint) hint.hidden = !drawing.tool;
}

function undoDrawing() {
  const last = drawing.history.pop();
  const layer = last && drawing.layers[last.key];
  if (!layer) return;
  last.undo();
  redraw(layer);
}

function clearDrawings() {
  for (const layer of Object.values(drawing.layers)) {
    const removed = layer.shapes.splice(0);
    if (removed.length) drawing.history.push({ key: layer.key, undo: () => layer.shapes.push(...removed) });
    redraw(layer);
  }
}

// The waterfalls with their drawings as a PNG, as they show on the
// page: blended with the slider, or side by side.
function saveDrawingPng() {
  const wrapper = document.querySelector('.harwrapper');
  const parts = ['har1', 'har2']
    .map(key => drawing.layers[key])
    .filter(layer => layer && layer.base.isConnected && dimensions(layer))
    .map(layer => ({
      layer,
      dims: dimensions(layer),
      box: layer.base.getBoundingClientRect(),
      opacity: Number(getComputedStyle(layer.container).opacity),
      label: (document.getElementById(layer.key + 'Label') || {}).textContent || layer.key
    }))
    .filter(p => p.opacity > 0.01);
  if (!parts.length || !wrapper) return;
  const origin = wrapper.getBoundingClientRect();
  const ratio = parts[0].layer.base.width / parts[0].box.width;
  const labelHeight = 32;
  // One label above each place. Blended waterfalls share a place.
  const labels = new Map();
  for (const p of parts) {
    const at = Math.round(p.box.left - origin.left) + ',' + Math.round(p.box.top - origin.top);
    labels.set(at, (labels.has(at) ? labels.get(at) + ' / ' : '') + p.label);
  }
  const out = document.createElement('canvas');
  out.width = Math.round(Math.max(...parts.map(p => p.box.right - origin.left)) * ratio);
  out.height = Math.round(Math.max(...parts.map(p => p.box.bottom - origin.top + labelHeight)) * ratio);
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = '#111827';
  ctx.font = '600 15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.textBaseline = 'middle';
  for (const [at, label] of labels) {
    const [x, y] = at.split(',').map(Number);
    ctx.fillText(label, x + 8, y + labelHeight / 2);
  }
  for (const p of parts) {
    const x = p.box.left - origin.left;
    const y = p.box.top - origin.top + labelHeight;
    ctx.globalAlpha = p.opacity;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.drawImage(p.layer.base, x, y, p.box.width, p.box.height);
    const s = scaleOf(p.layer, p.dims) * ratio;
    ctx.setTransform(s, 0, 0, s, x * ratio, y * ratio);
    drawShapes(ctx, p.dims, p.layer.shapes);
  }
  out.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'compare-waterfall.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, 'image/png');
}

document.addEventListener('keydown', e => {
  if (!drawing.tool || (e.target instanceof Element && e.target.closest('input, textarea'))) return;
  if (e.key === 'Escape') setDrawTool(null);
  if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
    e.preventDefault();
    undoDrawing();
  }
});
