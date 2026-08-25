export function toIsoString(value: Date): string {
  return value.toISOString();
}

export function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}
