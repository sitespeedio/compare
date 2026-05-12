/* exported initFilmstripNav */

//
// Filmstrip navigation enhancements.
//
// - Mouse drag scrolls the rail horizontally (more discoverable than
//   the native scrollbar for long strips). We only kick in if the
//   user actually moves while holding down; a plain click still goes
//   through to the lightbox-trigger inside the cell.
// - Arrow keys move focus between cells when one is focused. Home /
//   End jump to the start / end of the strip.
//
// Delegation-based so newly-generated rails (after Switch or after
// uploading a new HAR pair) pick up the same behaviour without a
// re-wire.
//

function initFilmstripNav() {
  if (window.__filmstripNavInstalled) return;
  window.__filmstripNavInstalled = true;

  const DRAG_THRESHOLD_PX = 4;

  document.body.addEventListener('mousedown', function (e) {
    if (!(e.target instanceof HTMLElement)) return;
    const rail = e.target.closest('.filmstrip-rail');
    if (!rail) return;
    // Ignore mousedown on the actual zoom button — let the lightbox
    // handle that click. Drag-scroll triggers on mousedown anywhere
    // else inside the rail (the padding, the column gap, etc.).
    if (e.target.closest('.lightbox-trigger')) {
      // Still want to allow drag if user moves before releasing; we
      // arm a "candidate" state and promote to dragging only after
      // crossing the threshold.
    }
    if (e.button !== 0) return;

    const startX = e.pageX;
    const startScroll = rail.scrollLeft;
    let dragging = false;

    function onMove(ev) {
      const dx = ev.pageX - startX;
      if (!dragging && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
        dragging = true;
        rail.classList.add('is-dragging');
      }
      if (dragging) {
        rail.scrollLeft = startScroll - dx;
        ev.preventDefault();
      }
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (dragging) {
        rail.classList.remove('is-dragging');
        // Swallow the click that would otherwise follow the
        // mouseup — otherwise a drag would also open the lightbox.
        ev.preventDefault();
        ev.stopPropagation();
        const swallow = function (ce) {
          ce.stopPropagation();
          ce.preventDefault();
          document.removeEventListener('click', swallow, true);
        };
        document.addEventListener('click', swallow, true);
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  document.body.addEventListener('keydown', function (e) {
    if (!(e.target instanceof HTMLElement)) return;
    const cell = e.target.closest('.filmstrip-cell');
    if (!cell) return;
    const column = cell.closest('.filmstrip-column');
    if (!column) return;

    let next = null;
    if (e.key === 'ArrowRight') {
      const nextCol = column.nextElementSibling;
      next = nextCol && nextCol.querySelector('.filmstrip-cell:not(.filmstrip-cell--missing)');
    } else if (e.key === 'ArrowLeft') {
      const prevCol = column.previousElementSibling;
      next = prevCol && prevCol.querySelector('.filmstrip-cell:not(.filmstrip-cell--missing)');
    } else if (e.key === 'ArrowDown') {
      // Move from HAR1 cell to HAR2 cell within the same column.
      next = column.querySelectorAll('.filmstrip-cell')[1];
    } else if (e.key === 'ArrowUp') {
      next = column.querySelectorAll('.filmstrip-cell')[0];
    } else if (e.key === 'Home') {
      const rail = column.parentElement;
      next = rail && rail.querySelector('.filmstrip-cell:not(.filmstrip-cell--missing)');
    } else if (e.key === 'End') {
      const rail = column.parentElement;
      const all = rail && rail.querySelectorAll('.filmstrip-cell:not(.filmstrip-cell--missing)');
      next = all && all[all.length - 1];
    } else {
      return;
    }

    if (next) {
      e.preventDefault();
      next.focus();
      next.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  });
}

document.addEventListener('DOMContentLoaded', initFilmstripNav);
