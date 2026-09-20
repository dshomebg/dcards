// `%`, `_` и `\` са метазнаци в LIKE — без escape „%" би върнал всички редове.
// Заявката трябва да добави `ESCAPE '\'`.
export function likePattern(query: string): string {
  const escaped = query.replace(/[\\%_]/g, (char) => '\\' + char);
  return `%${escaped}%`;
}
