/* exported initLightbox */

//
// Lightbox overlay for screenshots and filmstrip frames.
//
// Replaces the old "open image in a new tab" behaviour. A click on
// any thumbnail wired to the lightbox shows the full image in an
// in-page overlay so the user keeps their place in the comparison
// instead of fighting the browser's tab management.
//
// Delegation-based: a single click listener on document.body catches
// clicks on:
//   - .pageXrayCapture          (final-screenshot row in page-x-ray)
//   - .filmstrip-frame img      (filmstrip cells)
//   - any element with data-lightbox-src
//
// Esc closes; clicking the backdrop closes; clicking the image itself
// stays open so accidental drags don't dismiss.
//

function initLightbox() {
  if (document.getElementById('lightbox')) return;

  const overlay = document.createElement('div');
  overlay.id = 'lightbox';
  overlay.className = 'lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Image viewer');
  overlay.hidden = true;
  overlay.innerHTML =
    '<figure class="lightbox-figure">' +
      '<button type="button" class="lightbox-close" aria-label="Close image viewer">×</button>' +
      '<img class="lightbox-img" alt="">' +
      '<figcaption class="lightbox-caption"></figcaption>' +
    '</figure>';
  document.body.appendChild(overlay);

  const img = overlay.querySelector('.lightbox-img');
  const caption = overlay.querySelector('.lightbox-caption');
  const closeBtn = overlay.querySelector('.lightbox-close');
  const figure = overlay.querySelector('.lightbox-figure');

  let lastFocused = null;

  function open(src, alt) {
    if (!src) return;
    lastFocused = document.activeElement;
    img.src = src;
    img.alt = alt || '';
    caption.textContent = alt || '';
    overlay.hidden = false;
    // Force a reflow so the opacity transition runs.
    void overlay.offsetWidth;
    overlay.classList.add('lightbox--open');
    closeBtn.focus();
    document.addEventListener('keydown', onKey);
  }

  function close() {
    overlay.classList.remove('lightbox--open');
    overlay.hidden = true;
    img.src = '';
    document.removeEventListener('keydown', onKey);
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  overlay.addEventListener('click', function (e) {
    // Anywhere except the figure itself dismisses the overlay.
    if (e.target === overlay) close();
  });
  figure.addEventListener('click', function (e) {
    // Clicks on the close button bubble here; everything else inside
    // the figure (image, caption) is a no-op so the dialog stays open
    // when the user re-clicks the image.
    if (e.target.closest('.lightbox-close')) close();
  });

  // Click delegation — any .lightbox-trigger button containing an
  // <img> opens that image in the overlay. Buttons handle keyboard
  // activation (Enter / Space) natively, no extra wiring needed.
  document.body.addEventListener('click', function (e) {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;
    const trigger = target.closest('.lightbox-trigger');
    if (!trigger) return;
    const innerImg = trigger.querySelector('img');
    if (!innerImg) return;
    const src = innerImg.getAttribute('src');
    let alt = innerImg.getAttribute('alt') || '';
    if (!alt) {
      // Filmstrip frames carry the timestamp in the sibling
      // <figcaption>; surface that as the lightbox caption.
      const fig = trigger.closest('.filmstrip-frame');
      const cap = fig && fig.querySelector('figcaption');
      if (cap) alt = cap.textContent;
    }
    e.preventDefault();
    open(src, alt);
  });
}

document.addEventListener('DOMContentLoaded', initLightbox);
