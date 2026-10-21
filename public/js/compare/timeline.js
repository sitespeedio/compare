/* global generateVisualProgress, prefersReducedMotion, parseTemplate */
/* exported initTimeline, setTimelineTime, scrubTimeline, toggleTimelinePlay, stopTimeline, addTimelineWaterfall, divergenceBands, setTimelineSpeed, stepTimelineFrame, jumpTimeline, replaceMissingFrame */

// The shared time cursor. The visual progress chart, the two videos (or
// filmstrip frames), the milestone timeline, the filmstrip and the
// waterfalls all follow it.
const timeline = {
  t: 0,
  maxTime: 1,
  firstVisual: 0,
  speed: 1,
  playing: false,
  raf: 0,
  chart: null,
  sides: {},
  columns: [],
  current: null,
  waterfalls: {},
  // Frame images that did not load.
  missingFrames: new Set()
};

// Time ranges where the visual progress of the two runs differs by
// threshold percentage points or more.
function divergenceBands(vp1, vp2, maxTime, threshold = 20) {
  const steps = vp => Object.keys(vp || {}).map(t => [Number(t), vp[t]]).sort((a, b) => a[0] - b[0]);
  const s1 = steps(vp1);
  const s2 = steps(vp2);
  if (!s1.length || !s2.length) return [];
  const at = (s, t) => lastAtOrBefore(s, t, step => step[0])[1];
  const times = [...new Set([0, ...s1.map(s => s[0]), ...s2.map(s => s[0])])]
    .filter(t => t < maxTime)
    .sort((a, b) => a - b);
  const bands = [];
  times.forEach((t, i) => {
    const end = i + 1 < times.length ? times[i + 1] : maxTime;
    if (Math.abs(at(s1, t) - at(s2, t)) < threshold) return;
    const last = bands[bands.length - 1];
    if (last && last.to === t) last.to = end;
    else bands.push({ from: t, to: end });
  });
  return bands;
}

// The image of the frame at ms. When that image did not load, the frame
// nearest in time that did (the earlier one on a tie): the frame before
// a missing first visual change is often still blank.
function frameAt(key, ms) {
  const side = timeline.sides[key];
  const frames = (side && side.frames) || [];
  if (!frames.length) return null;
  const wanted = lastAtOrBefore(frames, ms, f => f.ms);
  if (!timeline.missingFrames.has(wanted.img)) return wanted.img;
  const timeOf = f => (f.sourceMs === undefined ? f.ms : f.sourceMs);
  let nearest = null;
  for (const f of frames) {
    if (timeline.missingFrames.has(f.img)) continue;
    if (!nearest || Math.abs(timeOf(f) - timeOf(wanted)) < Math.abs(timeOf(nearest) - timeOf(wanted))) nearest = f;
  }
  return nearest && nearest.img;
}

// A frame image did not load. Some sitespeed.io runs have VisualProgress
// times with no image on disk. Show the nearest frame instead.
function replaceMissingFrame(img) {
  const cell = img.closest('.filmstrip-cell');
  if (!img.classList.contains('timeline-frame') && !cell) return;
  timeline.missingFrames.add(img.getAttribute('src'));
  const key = cell ? (cell.classList.contains('filmstrip-cell--har2') ? '2' : '1') : img.dataset.side;
  const column = img.closest('.filmstrip-column');
  const replacement = frameAt(key, column ? Number(column.dataset.ms) : timeline.t);
  if (replacement && replacement !== img.getAttribute('src')) img.setAttribute('src', replacement);
}

function lastAtOrBefore(list, t, getTime) {
  let found = list[0];
  for (const item of list) {
    if (getTime(item) <= t) found = item;
  }
  return found;
}

/**
 * @param {Object} opts
 * @param {number} opts.maxTime
 * @param {number} opts.start
 * @param {number} opts.firstVisual where "Jump to first visual change" goes
 * @param {Object} opts.chart runs and markers for generateVisualProgress
 * @param {Array} opts.track milestones and long tasks per HAR for the timeline
 * @param {Object<string, {frames: Array, vp: Object}>} opts.sides keyed by '1' and '2'
 */
function initTimeline(opts) {
  stopTimeline();
  timeline.maxTime = Math.max(opts.maxTime, 1);
  timeline.firstVisual = opts.firstVisual || 0;
  timeline.sides = opts.sides;
  timeline.waterfalls = {};
  timeline.current = null;
  const bands = divergenceBands(opts.sides[1].vp, opts.sides[2].vp, timeline.maxTime);
  timeline.chart = generateVisualProgress('visualProgress', {
    ...opts.chart,
    bands,
    maxTime: timeline.maxTime,
    onTime: scrubTimeline
  });
  const note = document.getElementById('vpBandNote');
  if (note) note.hidden = !bands.length;

  const end = timeline.maxTime;
  const tickStep = end <= 2000 ? 500 : end <= 6000 ? 1000 : end <= 15000 ? 2000 : 5000;
  const ticks = [];
  for (let t = 0; t <= end; t += tickStep) ticks.push(t);
  parseTemplate('timelineTrackTemplate', { sides: opts.track, end, ticks, bands }, 'timelineTrackContent');
  addAxisControls();

  timeline.columns = [...document.querySelectorAll('#filmstripContent .filmstrip-column')];
  setTimelineSpeed(timeline.speed);
  setTimelineTime(opts.start || 0, true);
}

// Drag on the timeline or use the arrow keys to move the cursor.
function addAxisControls() {
  const track = document.getElementById('timelineTrack');
  const axis = document.getElementById('timelineAxis');
  if (!track || !axis) return;
  const timeAt = e => {
    const r = track.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * timeline.maxTime;
  };
  axis.addEventListener('pointerdown', e => {
    axis.setPointerCapture(e.pointerId);
    scrubTimeline(timeAt(e));
  });
  axis.addEventListener('pointermove', e => {
    if (axis.hasPointerCapture(e.pointerId)) scrubTimeline(timeAt(e));
  });
  axis.addEventListener('keydown', e => {
    const step = e.shiftKey ? 500 : 100;
    const keys = {
      ArrowLeft: timeline.t - step,
      ArrowRight: timeline.t + step,
      Home: 0,
      End: timeline.maxTime
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    scrubTimeline(keys[e.key]);
  });
}

// Move the cursor because the user pointed somewhere.
function scrubTimeline(t) {
  stopTimeline();
  setTimelineTime(t, true);
}

function setTimelineTime(t, seekVideos) {
  timeline.t = Math.max(0, Math.min(timeline.maxTime, Number(t) || 0));
  const ms = timeline.t;
  const pct = ((ms / timeline.maxTime) * 100).toFixed(3) + '%';

  if (timeline.chart) timeline.chart.setCursor(ms);
  const label = document.getElementById('timelineTime');
  if (label) label.textContent = (ms / 1000).toFixed(3) + ' s';
  const playhead = document.getElementById('timelinePlayhead');
  if (playhead) playhead.style.left = pct;
  const fill = document.getElementById('timelineFill');
  if (fill) fill.style.width = pct;
  const axis = document.getElementById('timelineAxis');
  if (axis) {
    axis.setAttribute('aria-valuenow', String(Math.round(ms)));
    axis.setAttribute('aria-valuetext', (ms / 1000).toFixed(2) + ' seconds');
  }
  // Milestone chips and flags light up once the cursor has passed them.
  for (const el of document.querySelectorAll('#timelineTrackContent [data-t]')) {
    el.classList.toggle('is-passed', ms >= Number(el.dataset.t));
  }
  for (const band of document.querySelectorAll('#timelineTrackContent .rendering-band')) {
    band.classList.toggle('rendering-band--active', ms >= Number(band.dataset.from) && ms < Number(band.dataset.to));
  }

  for (const [key, side] of Object.entries(timeline.sides)) {
    const progress = document.querySelector('.timeline-progress[data-side="' + key + '"]');
    const vp = Object.entries(side.vp || {}).map(([time, value]) => ({ time: Number(time), value }));
    if (progress && vp.length) {
      progress.textContent = lastAtOrBefore(vp, ms, v => v.time).value + '% rendered';
    }
    const frame = document.querySelector('.timeline-frame[data-side="' + key + '"]');
    const img = frameAt(key, ms);
    if (frame && img && frame.getAttribute('src') !== img) frame.setAttribute('src', img);
    const video = document.querySelector('.timeline-video[data-side="' + key + '"]');
    if (video && seekVideos && Math.abs(video.currentTime - ms / 1000) > 0.04) {
      video.currentTime = ms / 1000;
    }
  }

  let current = null;
  for (const column of timeline.columns) {
    if (Number(column.dataset.ms) <= ms) current = column;
    column.classList.remove('filmstrip-column--current');
  }
  if (current) current.classList.add('filmstrip-column--current');
  if (current && current !== timeline.current) {
    timeline.current = current;
    keepInView(current);
  }

  for (const wf of Object.values(timeline.waterfalls)) placeWaterfallCursor(wf);
}

// Scroll the filmstrip so the current frame stays visible. Only scrolls
// when the frame is about to leave the view, so playing does not jitter.
function keepInView(column) {
  const rail = column.closest('.filmstrip-rail');
  if (!rail) return;
  const c = column.getBoundingClientRect();
  const r = rail.getBoundingClientRect();
  if (c.left >= r.left && c.right <= r.right) return;
  rail.scrollBy({
    left: c.left - r.left - (r.width - c.width) / 2,
    behavior: prefersReducedMotion() ? 'auto' : 'smooth'
  });
}

function setTimelineSpeed(speed) {
  timeline.speed = Number(speed) || 1;
  for (const button of document.querySelectorAll('[data-action="timeline-speed"]')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === timeline.speed));
  }
  for (const video of document.querySelectorAll('.timeline-video')) video.playbackRate = timeline.speed;
}

// Go to the previous or next filmstrip frame.
function stepTimelineFrame(direction) {
  const times = timeline.columns.map(c => Number(c.dataset.ms));
  const next = direction > 0
    ? times.find(t => t > timeline.t + 0.5)
    : times.filter(t => t < timeline.t - 0.5).pop();
  scrubTimeline(next === undefined ? (direction > 0 ? timeline.maxTime : 0) : next);
}

function jumpTimeline() {
  scrubTimeline(timeline.firstVisual);
}

/**
 * Show the cursor on a waterfall-tools waterfall. The renderer knows
 * where its time axis starts (labelsWidth) and its scale (widthPerMs).
 */
function addTimelineWaterfall(key, renderer, container) {
  const cursor = document.createElement('div');
  cursor.className = 'wf-cursor';
  container.appendChild(cursor);
  const wf = { renderer, container, cursor };
  timeline.waterfalls[key] = wf;
  // waterfall-tools draws in the next frames and again on resize.
  let tries = 0;
  const place = () => {
    placeWaterfallCursor(wf);
    if (!cursor.style.left && ++tries < 30) requestAnimationFrame(place);
  };
  place();
  // waterfall-tools sets the canvas size after the container changes.
  const resize = new ResizeObserver(() => placeWaterfallCursor(wf));
  resize.observe(container);
  const canvas = container.querySelector('canvas');
  if (canvas) resize.observe(canvas);
}

function placeWaterfallCursor(wf) {
  const dims = wf.renderer && wf.renderer.drawnRows && wf.renderer.drawnRows.dimensions;
  const canvas = wf.container.querySelector('canvas');
  if (!dims || !canvas || !dims.canvasWidth) return;
  const x = (dims.labelsWidth + timeline.t * dims.widthPerMs) * (canvas.clientWidth / dims.canvasWidth);
  wf.cursor.style.left = x.toFixed(1) + 'px';
}

function toggleTimelinePlay() {
  if (timeline.playing) stopTimeline();
  else playTimeline();
}

function playTimeline() {
  if (timeline.t >= timeline.maxTime) setTimelineTime(0, true);
  timeline.playing = true;
  updatePlayButton();
  document.getElementById('visualProgress').classList.add('vp-chart--playing');
  const track = document.getElementById('timelineTrack');
  if (track) track.classList.add('rendering-timeline--playing');
  const videos = [...document.querySelectorAll('.timeline-video')];
  for (const video of videos) {
    video.currentTime = timeline.t / 1000;
    video.playbackRate = timeline.speed;
    video.play().catch(() => {});
  }
  let last = performance.now();
  const step = now => {
    if (!timeline.playing) return;
    // A playing video drives the clock so frames and cursor stay in step.
    const lead = videos.find(v => !v.paused && !v.ended);
    const t = lead ? lead.currentTime * 1000 : timeline.t + (now - last) * timeline.speed;
    last = now;
    if (t >= timeline.maxTime) {
      setTimelineTime(timeline.maxTime, false);
      stopTimeline();
      return;
    }
    setTimelineTime(t, false);
    timeline.raf = requestAnimationFrame(step);
  };
  timeline.raf = requestAnimationFrame(step);
}

function stopTimeline() {
  timeline.playing = false;
  cancelAnimationFrame(timeline.raf);
  const chart = document.getElementById('visualProgress');
  if (chart) chart.classList.remove('vp-chart--playing');
  const track = document.getElementById('timelineTrack');
  if (track) track.classList.remove('rendering-timeline--playing');
  for (const video of document.querySelectorAll('.timeline-video')) video.pause();
  updatePlayButton();
}

function updatePlayButton() {
  const button = document.getElementById('timelinePlay');
  if (!button) return;
  button.textContent = timeline.playing ? '❚❚ Pause' : '▶ Play';
  button.setAttribute('aria-pressed', timeline.playing ? 'true' : 'false');
}
