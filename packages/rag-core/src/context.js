/**
 * Reserve a bounded character budget for evidence, leaving room for instructions and output.
 * Token counts vary by language/model; characters are an explicit approximation here.
 */
export function buildContext(hits, maxCharacters = 6000) {
  const sources = [];
  let used = 0;
  for (const hit of hits) {
    const label = `S${sources.length + 1}`;
    const header = `[${label}] ${hit.title} (characters ${hit.start}–${hit.end})\n`;
    if (used + header.length + hit.text.length + 2 > maxCharacters) continue;
    const { vector, ...source } = hit; // Never expose large embedding arrays to the browser or LLM.
    sources.push({ ...source, label });
    used += header.length + hit.text.length + 2;
  }
  return {
    sources,
    characters: used,
    text: sources
      .map((s) => `[${s.label}] ${s.title} (characters ${s.start}–${s.end})\n${s.text}`)
      .join('\n\n'),
  };
}

/** Check reference integrity; this does NOT prove that a cited sentence is factually supported. */
export function validateCitations(answer, sources) {
  const allowed = new Set(sources.map((s) => s.label));
  const cited = [...new Set(answer.citations)];
  if (cited.some((label) => !allowed.has(label)))
    throw new Error('The answer referenced an unknown source.');
  if (!answer.supported && cited.length)
    throw new Error('An unsupported answer must not cite evidence.');
  const inline = [...answer.answer.matchAll(/\[(S\d+)\]/g)].map((match) => match[1]);
  if (inline.some((label) => !allowed.has(label) || !cited.includes(label)))
    throw new Error('Inline citation is unknown or missing from the citation list.');
  if (cited.some((label) => !inline.includes(label)))
    throw new Error('Citation list contains a source that is not referenced inline.');
  if (answer.supported && (!cited.length || !inline.length))
    throw new Error('A supported answer must cite evidence inline and in its citation list.');
  return {
    valid: true,
    count: cited.length,
    note: 'Reference validation only; inspect passages to assess factual support.',
  };
}
