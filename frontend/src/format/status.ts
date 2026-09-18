// statuses stay snake_case on the wire, this is the only place they are dressed
// up for a person to read
export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}
