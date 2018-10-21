/* exported showUpload, formatDate, toggleRow, hideUpload, objectPropertiesToArray, formatTime, showLoading, errorMessage, formatBytes, changeOpacity*/

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

function formatTime(ms) {
  return ms + ' ms';
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return '0 B';
  }

  return Math.round(bytes / 1000) + ' kb';
}
function changeOpacity(val, id1, id2) {
  const el1 = document.getElementById(id1);
  const el2 = document.getElementById(id2);
  el2.style.opacity = val;
  el1.style.opacity = Math.abs(1 - val);

  // make sure we can see the extra info
  if (val > 0.5) {
    el1.style['z-index'] = -1;
    el2.style['z-index'] = 1;
  } else {
    el1.style['z-index'] = 1;
    el2.style['z-index'] = -1;
  }
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
