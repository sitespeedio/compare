/* exported updateInit */

/**
 * JavaScript functionality for the Service Worker update available prompt
 */
const elementCache = {
  dialog: document.querySelector('.update-available'),
  reloadButton: document.querySelector('.update-reload'),
  dismissButton: document.querySelector('.update-dismiss')
};

function showUpdateDialog() {
  elementCache.dialog.classList.add('update-visible');
}

function addUpdateEvents() {
  elementCache.dismissButton.addEventListener('click', evt => {
    evt.preventDefault();
    elementCache.dialog.classList.remove('update-visible');
  });

  elementCache.reloadButton.addEventListener('click', evt => {
    evt.preventDefault();
    window.location.reload();
  });
}

function updateInit() {
  showUpdateDialog();
  addUpdateEvents();
}
