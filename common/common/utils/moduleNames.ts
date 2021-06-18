export function stripModuleName(name: string) {
  return name.replace(/\w+::/g, "");
}
