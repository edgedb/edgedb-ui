export function tidyIndents(code: string) {
  return code
    .trim()
    .replace(
      /\n( {4})+/g,
      (match) => "\n" + match.slice(1, 1 + (match.length - 1) / 2)
    );
}
