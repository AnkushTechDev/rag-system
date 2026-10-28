import { createHash } from 'node:crypto';
const sha = (text) => createHash('sha256').update(text).digest('hex');
const canonical = (text) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Validate a deliberately small single-turn chat dataset. Unlike RAG documents, these
 * examples contain the desired assistant response: the target used to compute loss.
 * `group` is optional preparation metadata; it is stripped before exporting to MLX.
 */
export function prepareDataset(jsonl, { seed = '42' } = {}) {
  const errors = [],
    warnings = [],
    records = [],
    seen = new Set(),
    targets = new Map(),
    links = [];
  let duplicates = 0;
  if (typeof jsonl !== 'string' || jsonl.length > 180000)
    return {
      valid: false,
      errors: ['Dataset must be JSONL text with at most 180,000 characters.'],
      warnings,
    };
  const lines = jsonl
    .split(/\r?\n/)
    .map((text, index) => ({ text, index }))
    .filter((row) => row.text.trim());
  if (lines.length > 200)
    return { valid: false, errors: ['Learning limit: 200 examples.'], warnings };
  for (const { text, index } of lines) {
    const label = `Line ${index + 1}`;
    let row;
    try {
      row = JSON.parse(text);
    } catch {
      errors.push(`${label}: invalid JSON.`);
      continue;
    }
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      Object.keys(row).some((key) => !['messages', 'group'].includes(key))
    ) {
      errors.push(`${label}: use only messages and optional group.`);
      continue;
    }
    if (
      !Array.isArray(row.messages) ||
      row.messages.length !== 3 ||
      row.messages.some(
        (message, i) =>
          !message ||
          message.role !== ['system', 'user', 'assistant'][i] ||
          typeof message.content !== 'string' ||
          !message.content.trim() ||
          message.content.length > 6000 ||
          Object.keys(message).some((key) => !['role', 'content'].includes(key)),
      )
    ) {
      errors.push(
        `${label}: expected exactly system, user, assistant messages with nonempty text (max 6,000 characters each).`,
      );
      continue;
    }
    if (
      row.group !== undefined &&
      (typeof row.group !== 'string' || !row.group.trim() || row.group.length > 120)
    ) {
      errors.push(`${label}: group must be 1–120 characters.`);
      continue;
    }
    const messages = row.messages.map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
    const promptKey = canonical(messages[0].content) + '|' + canonical(messages[1].content);
    const targetKey = sha(messages[2].content);
    if (targets.has(promptKey) && targets.get(promptKey) !== targetKey) {
      errors.push(`${label}: conflicting targets for an identical normalized prompt.`);
      continue;
    }
    targets.set(promptKey, targetKey);
    const key = sha(JSON.stringify(messages));
    links.push({ group: row.group?.trim() || `prompt:${sha(promptKey)}`, promptKey });
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    records.push({ messages, group: row.group?.trim() || `prompt:${sha(promptKey)}`, promptKey });
  }
  if (records.length < 12)
    errors.push(
      'Use at least 12 unique examples for the learning split. This is an app rule, not a provider minimum.',
    );
  if (errors.length) return { valid: false, errors, warnings, duplicates };

  // Union groups that share a normalized prompt. A manually assigned group cannot
  // force an identical prompt into both training and held-out partitions.
  const parent = new Map();
  function root(key) {
    if (!parent.has(key)) parent.set(key, key);
    if (parent.get(key) !== key) parent.set(key, root(parent.get(key)));
    return parent.get(key);
  }
  const promptGroup = new Map();
  links.forEach((row) => {
    root(row.group);
    if (promptGroup.has(row.promptKey)) {
      const a = root(row.group),
        b = root(promptGroup.get(row.promptKey));
      parent.set(a < b ? b : a, a < b ? a : b);
    } else promptGroup.set(row.promptKey, row.group);
  });
  const groups = new Map();
  records.forEach((row) => {
    const key = root(row.group);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  if (groups.size < 5)
    return {
      valid: false,
      errors: [
        'Use at least five independent prompt/scenario groups to create meaningful separate splits.',
      ],
      warnings,
      duplicates,
    };
  // Hash ordering gives reproducibility, including when input line order changes.
  const ordered = [...groups].sort((a, b) =>
    sha(`${seed}:${a[0]}`).localeCompare(sha(`${seed}:${b[0]}`)),
  );
  const heldOut = Math.max(1, Math.floor(ordered.length * 0.15));
  const split = { train: [], valid: [], test: [] };
  const groupCounts = { train: 0, valid: 0, test: 0 };
  ordered.forEach(([, rows], i) => {
    const name = i < heldOut ? 'test' : i < 2 * heldOut ? 'valid' : 'train';
    groupCounts[name] += 1;
    split[name].push(
      ...rows.sort((a, b) =>
        sha(JSON.stringify(a.messages)).localeCompare(sha(JSON.stringify(b.messages))),
      ),
    );
  });
  if (split.train.length < 10)
    errors.push('The split leaves fewer than 10 training examples. Add more independent groups.');
  if (records.length < 50)
    warnings.push(
      'Small teaching dataset: use more varied, human-reviewed examples before expecting useful improvements.',
    );
  warnings.push(
    'Automatic grouping only catches identical normalized prompts. Label paraphrases and shared source scenarios with the same group to reduce leakage.',
  );
  warnings.push(
    'Character counts do not enforce model token limits. Inspect tokenizer lengths before real training.',
  );
  if (duplicates) warnings.push(`${duplicates} exact duplicate example(s) removed.`);
  const files = Object.fromEntries(
    Object.entries(split).map(([name, rows]) => [
      `${name}.jsonl`,
      rows.map((row) => JSON.stringify({ messages: row.messages })).join('\n') + '\n',
    ]),
  );
  const counts = Object.fromEntries(
    Object.entries(split).map(([name, rows]) => [name, rows.length]),
  );
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    duplicates,
    counts,
    groupCounts,
    groupCount: groups.size,
    seed,
    fingerprint: sha(JSON.stringify(files)),
    files,
  };
}
