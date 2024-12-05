export function assertNever(value: never, message?: string): never {
  throw new Error(
    message ?? `Unhandled discriminated union member: ${JSON.stringify(value)}`
  );
}
