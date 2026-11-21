/**
 * A deliberately tiny JSON Schema checker covering only the keywords
 * schema.ts uses (type, enum, required, properties, additionalProperties).
 * Test-only: it keeps the published schema honest without a validator
 * dependency. Returns a list of problems; empty means valid.
 */
type Schema = {
  type?: string | readonly string[];
  enum?: readonly unknown[];
  required?: readonly string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean;
};

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

function typeMatches(actual: string, expected: string): boolean {
  return actual === expected || (expected === 'number' && actual === 'integer');
}

export function validate(schema: Schema, value: unknown, path = '$'): string[] {
  const problems: string[] = [];
  if (schema.enum && !schema.enum.includes(value)) {
    problems.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  if (schema.type) {
    const allowed = typeof schema.type === 'string' ? [schema.type] : schema.type;
    const actual = typeOf(value);
    if (!allowed.some((t) => typeMatches(actual, t))) {
      problems.push(`${path}: expected ${allowed.join(' | ')}, got ${actual}`);
      return problems;
    }
  }
  if (typeOf(value) === 'object' && (schema.properties || schema.required)) {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) problems.push(`${path}.${key}: required`);
    }
    for (const [key, v] of Object.entries(obj)) {
      const sub = schema.properties?.[key];
      if (sub) problems.push(...validate(sub, v, `${path}.${key}`));
      else if (schema.additionalProperties === false) problems.push(`${path}.${key}: not allowed`);
    }
  }
  return problems;
}
