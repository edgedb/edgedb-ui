export function findLastIndex<T>(
  array: T[],
  predicate: (item: T) => boolean
): number {
  for (let i = array.length; i >= 0; i--) {
    if (predicate(array[i])) {
      return i;
    }
  }
  return array.length;
}
