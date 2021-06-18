export function reverseMap<T, R>(
  arr: T[],
  func: (value: T, index: number, array: T[]) => R
): R[] {
  const len = arr.length - 1;
  return arr.map((_, i) => func(arr[len - i], i, arr));
}
