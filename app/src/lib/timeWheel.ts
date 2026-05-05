export function getCenteredWheelSideSpacerHeight(rowHeight: number) {
  return `calc(50% - ${rowHeight / 2}px)`;
}

export function getCenteredWheelScrollTop(
  value: number,
  options: number[],
  rowHeight: number,
) {
  const index = options.indexOf(value);
  if (index < 0) return null;

  return index * rowHeight;
}

export function getCenteredWheelValue(
  scrollTop: number,
  options: number[],
  rowHeight: number,
) {
  const clampedIndex = Math.max(
    0,
    Math.min(options.length - 1, Math.round(scrollTop / rowHeight)),
  );

  return options[clampedIndex] ?? options[0] ?? 0;
}
