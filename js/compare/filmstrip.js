/* exported getFilmstrip */

/**
 * Get filmsstrip data.
 * @param {*} pagexray1
 * @param {*} pagexray2
 */

function getFilmstrip(pageXray1, pageXray2) {
  function getItem(o, t, timings) {
    return {
      img: o.file,
      time: (t / 10).toFixed(1),
      timings: timings
    };
  }

  const f1 = pageXray1.meta.filmstrip;
  const f2 = pageXray2.meta.filmstrip;

  const maxTiming =
    f1[f1.length - 1].time > f2[f2.length - 1].time
      ? f1[f1.length - 1].time
      : f2[f2.length - 1].time;

  const filmstrip1 = [];
  const filmstrip2 = [];
  let pos = 0;

  for (let i = 0; i <= maxTiming * 10; i += 1) {
    if (pos + 1 < f1.length && f1[pos + 1].time <= i / 10) {
      pos++;
      filmstrip1.push(getItem(f1[pos], i, f1[pos].timings));
    } else {
      filmstrip1.push(getItem(f1[pos], i));
    }
  }

  pos = 0;
  for (let i = 0; i <= maxTiming * 10; i += 1) {
    if (pos + 1 < f2.length && f2[pos + 1].time <= i / 10) {
      pos++;
      filmstrip2.push(getItem(f2[pos], i, f2[pos].timings));
    } else {
      filmstrip2.push(getItem(f2[pos], i));
    }
  }

  return { filmstrip1, filmstrip2 };
}
