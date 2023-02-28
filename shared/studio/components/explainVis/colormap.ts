const colormap = [
  [233, 227, 94],
  [219, 155, 58],
  [202, 12, 12],
];

export function getColor(percent: number) {
  const [l, r, p] =
    percent < 0.15
      ? [colormap[0], colormap[1], percent * (10 / 1.5)]
      : [colormap[1], colormap[2], (percent - 0.3) * (10 / 8.5)];
  return `rgb(${l[0] + (r[0] - l[0]) * p}, ${l[1] + (r[1] - l[1]) * p}, ${
    l[2] + (r[2] - l[2]) * p
  })`;
}
