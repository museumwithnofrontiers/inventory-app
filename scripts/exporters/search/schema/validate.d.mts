/** Types of `validate.mjs`. */
export const SCHEMA: string
export function documentErrors(doc: unknown, slugs: Set<string>): string[]
export function validatePackage(dir: string): { errors: string[]; documents: number; ids: string[] }
