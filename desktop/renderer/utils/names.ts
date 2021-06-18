type ClassName = string | undefined | null;

export function classNames(...names: ClassName[]): string {
  return names.filter((x) => !!x).join(" ");
}

export function stripModuleName(name: string) {
  return name.replace(/\w+::/g, "");
}
