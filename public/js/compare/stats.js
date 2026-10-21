/* exported median, mannWhitneyP, benjaminiHochberg */

function median(values) {
  if (!values.length) return undefined;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mannWhitneyU(a, b) {
  let u = 0;
  for (const x of a) {
    for (const y of b) u += x < y ? 1 : x === y ? 0.5 : 0;
  }
  return u;
}

// Two-sided Mann-Whitney U test. Exact (every split of the pooled
// values) for up to 16 values, normal approximation above that.
// Returns null when a side has fewer than two values.
function mannWhitneyP(a, b) {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 < 2 || n2 < 2) return null;
  const mean = (n1 * n2) / 2;
  const observed = Math.abs(mannWhitneyU(a, b) - mean);
  if (observed === 0) return 1;

  const all = a.concat(b);
  if (all.length > 16) {
    const sd = Math.sqrt((n1 * n2 * (all.length + 1)) / 12);
    const z = (observed - 0.5) / sd;
    return Math.min(1, 2 * (1 - normalCdf(z)));
  }

  let extreme = 0;
  let total = 0;
  const picked = [];
  const walk = start => {
    if (picked.length === n1) {
      const xs = picked.map(i => all[i]);
      const ys = all.filter((_, i) => !picked.includes(i));
      total++;
      if (Math.abs(mannWhitneyU(xs, ys) - mean) >= observed - 1e-9) extreme++;
      return;
    }
    for (let i = start; i <= all.length - (n1 - picked.length); i++) {
      picked.push(i);
      walk(i + 1);
      picked.pop();
    }
  };
  walk(0);
  return extreme / total;
}

// Abramowitz and Stegun 7.1.26
function normalCdf(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

// Benjamini-Hochberg adjusted p-values. Many metrics are tested at the
// same time, so some get p < 0.05 by chance. The adjusted values keep
// the expected part of false alarms under 5%. null stays null.
function benjaminiHochberg(ps) {
  const order = ps.map((p, i) => i).filter(i => ps[i] !== null).sort((i, j) => ps[i] - ps[j]);
  const adjusted = ps.slice();
  let min = 1;
  for (let k = order.length - 1; k >= 0; k--) {
    min = Math.min(min, (ps[order[k]] * order.length) / (k + 1));
    adjusted[order[k]] = min;
  }
  return adjusted;
}
