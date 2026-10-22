// Campos opcionais são omitidos quando a fonte não fornece valores válidos.
export function readScore(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const score = Number(value);
  return Number.isInteger(score) && score >= 0 && score <= 100 ? score : null;
}

export function readPlatforms(value) {
  return [['windows', 'Windows'], ['mac', 'macOS'], ['linux', 'Linux']]
    .filter(([key]) => value?.[key] === true).map(([, label]) => label);
}

export function readPrice(value) {
  if (value?.currency !== 'BRL' || !Number.isSafeInteger(value.final) || value.final < 0) {
    return { precoCentavos: null, precoOriginalCentavos: null, descontoPercentual: null };
  }
  const original = Number.isSafeInteger(value.initial) && value.initial > value.final ? value.initial : null;
  return {
    precoCentavos: value.final,
    precoOriginalCentavos: original,
    descontoPercentual: original ? Math.round((original - value.final) * 100 / original) : null,
  };
}
