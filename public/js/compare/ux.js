/* exported showUpload, formatDate, formatURL, toggleRow, hideUpload, objectPropertiesToArray, formatTime, showLoading, errorMessage, formatBytes, blendWaterfalls */

// Hide the upload functionality
function hideUpload() {
  hide('choosehars');
  hide('loading');
  show('result');
}

function removeAndHide() {
  function removeChildren(parentId) {
    const parent = document.getElementById(parentId);
    while (parent.childNodes.length > 0) {
      parent.removeChild(parent.firstChild);
    }
  }
  removeChildren('har1');
  removeChildren('har2');
  removeChildren('pageXrayContent');
  removeChildren('thirdPartyContent');
  removeChildren('visualProgressContent');
  hide('result');
  hide('loading');
}

// Show the upload functionality
function showUpload() {
  removeAndHide();
  show('choosehars');
}

function showLoading() {
  const el = document.getElementById('choosehars');
  el.style.display = 'none';
  const el2 = document.getElementById('loading');
  el2.style.display = 'block';
}

function objectPropertiesToArray(object) {
  const array = [];
  for (let key in object) {
    if (object.hasOwnProperty(key)) {
      array.push({ name: key, value: object[key] });
    }
  }
  return array.sort(function(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });
}

// Put a error message on the screen
function errorMessage(myMessage) {
  const message = document.getElementById('message');
  message.innerHTML = myMessage;
}

function show(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'block';
  }
}

function hide(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
  }
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function formatURL(url) {
  if (url.length > 90) {
    if (url.indexOf('/') > -1) {
      const ending = url.substring(url.length - 30, url.length);
      return url.substring(0, 56) + '....' + ending;
    }
  }
  return url;
}

function formatTime(ms) {
  if (ms !== undefined) {
    if (ms < 1000) {
      return ms + ' ms';
    } else {
      return Number(ms / 1000).toFixed(3) + ' s';
    }
  } else return '';
}

function formatBytes(bytes) {
  const KB = 1024;
  const MB = 1024 * 1024;

  if (!bytes || bytes < 0 || bytes === 'N/A') {
    return 'N/A';
  } else if (bytes === 0) {
    return '0 b';
  } else if (bytes < KB) {
    return Number(bytes) + ' B';
  } else if (bytes < MB) {
    return Number(bytes / KB).toFixed(1) + ' KB';
  } else {
    return Number(bytes / MB).toFixed(1) + ' MB';
  }
}
// Blend the HAR1/HAR2 waterfall canvases. 0 = show HAR1, 1 = show HAR2,
// in-between values cross-fade them. Both canvases render on the same
// time axis (via waterfall-tools' shared endTime option) so the bars
// line up visually as the slider moves.
function blendWaterfalls(value) {
  const v = Math.min(1, Math.max(0, Number(value) || 0));
  const har1 = document.getElementById('har1');
  const har2 = document.getElementById('har2');
  if (har1) har1.style.opacity = 1 - v;
  if (har2) har2.style.opacity = v;
}

function toggleRow(element, className, toggler) {
  const rows = element.parentNode.parentNode.parentNode.getElementsByClassName(
    className
  );

  for (let i = 0; i < rows.length; i++) {
    const status = rows[i].currentStyle
      ? rows[i].currentStyle.display
      : getComputedStyle(rows[i], null).display;

    if (status === 'none') {
      rows[i].style.display = 'table-row';
      toggler.style.transform = 'rotate(45deg)';
      toggler.style['-webkit-transform'] = 'rotate(45deg)';
    } else {
      rows[i].style.display = 'none';
      toggler.style.transform = 'rotate(-45deg)';
      toggler.style['-webkit-transform'] = 'rotate(-45deg)';
    }
  }
}
