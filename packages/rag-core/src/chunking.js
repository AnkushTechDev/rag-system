/**
 * Character-based recursive-ish splitting, intentionally visible instead of hidden in an SDK.
 * Offsets refer to the normalized document, in JavaScript UTF-16 code units, not tokens.
 * Overlap preserves local context at boundaries; it also increases storage and duplication.
 */
export function normalizeText(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
}

/** Split at paragraph/sentence/space boundaries when possible, with a guaranteed forward step. */
export function chunkText(input, { size = 700, overlap = 120 } = {}) {
  if (!Number.isInteger(size) || size < 100 || size > 2000)
    throw new RangeError('Chunk size must be 100–2000 characters.');
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= size / 2)
    throw new RangeError('Overlap must be smaller than half the chunk size.');
  const text = normalizeText(input);
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      // Prefer a meaningful boundary in the latter half so chunks do not become tiny.
      for (const separator of ['\n\n', '. ', '\n', ' ']) {
        const boundary = text.lastIndexOf(separator, end - separator.length);
        if (boundary > start + size / 2) {
          end = boundary + separator.length;
          break;
        }
      }
      // Never cut between the two UTF-16 units of an emoji/supplementary character.
      const code = text.charCodeAt(end - 1);
      if (code >= 0xd800 && code <= 0xdbff) end -= 1;
    }
    if (text.slice(start, end).trim())
      chunks.push({ index: chunks.length, start, end, text: text.slice(start, end) });
    if (end === text.length) break;
    let next = Math.max(start + 1, end - overlap);
    const code = text.charCodeAt(next);
    if (code >= 0xdc00 && code <= 0xdfff) next += 1;
    start = next;
  }
  return chunks;
}
