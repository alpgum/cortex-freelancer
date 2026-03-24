/**
 * Assignment engine
 */

const { hashToUnitInterval } = require('./hash');

function pickWeightedVariant(variants, unit) {
  const total = variants.reduce((s, v) => s + (v.weight ?? 0), 0);
  if (total <= 0) return variants[0]?.key;

  let acc = 0;
  for (const v of variants) {
    acc += (v.weight ?? 0) / total;
    if (unit < acc) return v.key;
  }
  return variants[variants.length - 1]?.key;
}

function assignVariant({ experimentKey, experiment, userId }) {
  const seed = `${experiment.salt}::${experimentKey}::${userId}`;
  const u = hashToUnitInterval(seed);
  return pickWeightedVariant(experiment.variants, u);
}

module.exports = { assignVariant, pickWeightedVariant };
