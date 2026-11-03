export function validateDisplayName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  if (!/^[A-Za-z0-9 _-]{2,20}$/.test(name)) {
    throw new Error(
      "Use 2–20 letters, numbers, spaces, underscores or hyphens.",
    );
  }
  return name;
}
