/**
 * The key that groups legacy rows naming one record, whatever their letter case.
 *
 * Legacy ran on Windows and MySQL, which compare keys without regard to case, so
 * one picture's English row can say `iam`/`i` where its other languages say
 * `IAM`/`I`. Grouping those rows by a case-sensitive key splits one picture in
 * two, and the second, colliding in the database, loses its languages.
 */
export function legacyKey(...parts: unknown[]): string {
  return parts
    .map((part) => String(part ?? ''))
    .join(':')
    .toLowerCase();
}
