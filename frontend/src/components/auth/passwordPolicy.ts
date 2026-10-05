export const passwordRequirements = [
  { label: "At least 8 characters", test: (value: string) => Array.from(value).length >= 8 },
  { label: "Uppercase letter (A-Z)", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Lowercase letter (a-z)", test: (value: string) => /[a-z]/.test(value) },
  { label: "Number (0-9)", test: (value: string) => /[0-9]/.test(value) },
  { label: "Special character", test: (value: string) => /[\p{P}\p{S}]/u.test(value) },
] as const;

export function meetsPasswordPolicy(value: string) {
  return Array.from(value).length <= 128 && passwordRequirements.every(({ test }) => test(value));
}
