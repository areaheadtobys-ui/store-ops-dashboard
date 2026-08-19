// Reference categorical palette (validated, fixed order — see dataviz skill).
export const CATEGORICAL = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
];

export const CHROME = {
  surface: '#fcfcfb',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  muted: '#898781',
  gridline: '#e1e0d9',
  axis: '#c3c2b7',
  good: '#0ca30c',
  goodText: '#006300',
  critical: '#d03b3b',
};

export function colorForIndex(i) {
  return CATEGORICAL[i % CATEGORICAL.length];
}
