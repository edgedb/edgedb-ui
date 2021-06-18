export default function classNames(
  ...names: (string | undefined | null | {[key: string]: boolean})[]
): string {
  const activeNames: string[] = [];
  for (const name of names) {
    if (!!name) {
      if (typeof name === "object") {
        for (const key of Object.keys(name)) {
          if (name[key]) activeNames.push(key);
        }
      } else activeNames.push(name);
    }
  }
  return activeNames.join(" ");
}
