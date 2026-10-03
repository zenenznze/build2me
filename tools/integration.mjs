// Project-root discovery binding. Planning is read-only; applying preserves all
// text outside the single managed block. Never follow links outside the target.
import fs from 'node:fs';
import path from 'node:path';

const START = '<!-- BUILD2ME:START -->';
const END = '<!-- BUILD2ME:END -->';
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
function inside(root, candidate) {
  const rel = path.relative(root, candidate);
  return !rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel);
}
function existsEntry(file) {
  try { fs.lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function destination(root, relative) {
  const file = path.join(root, relative);
  let existing = file;
  while (!existsEntry(existing)) existing = path.dirname(existing);
  if (!inside(root, fs.realpathSync(existing))) throw new Error('destination escapes target: ' + relative);
  if (fs.lstatSync(existing).isSymbolicLink() && !fs.existsSync(file)) throw new Error('broken destination link');
  return fs.existsSync(file) ? fs.realpathSync(file) : file;
}
function merge(original, block) {
  const starts = original.split(START).length - 1;
  const ends = original.split(END).length - 1;
  if (starts !== ends || starts > 1) throw new Error('ambiguous build2me markers; manual repair required');
  if (starts === 1) {
    const a = original.indexOf(START), b = original.indexOf(END);
    if (b < a) throw new Error('reversed build2me markers');
    return original.slice(0, a) + block + original.slice(b + END.length);
  }
  return original + (original.endsWith('\n') || !original ? '' : '\n') + '\n' + block + '\n';
}
export function preflightRuleEntries(target) {
  if (!fs.existsSync(target)) return;
  const root = fs.realpathSync(target);
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    if (!existsEntry(path.join(root, name))) continue;
    const file = destination(root, name);
    if (fs.existsSync(file)) merge(fs.readFileSync(file, 'utf8'), START + '\n' + END);
  }
}
export function planIntegration(target, graph) {
  const root = fs.realpathSync(target);
  const map = fs.realpathSync(graph);
  if (!inside(root, map)) throw new Error('graph must be inside the project root');
  for (const name of ['contracts', 'impl', 'laws', 'tools']) {
    if (!fs.statSync(path.join(map, name)).isDirectory()) throw new Error('missing graph directory: ' + name);
    if (!inside(root, fs.realpathSync(path.join(map, name)))) throw new Error('graph directory escapes target: ' + name);
  }
  for (const name of ['PROTOCOL.md', 'tools/frontier.mjs', 'tools/verify.mjs']) {
    if (!fs.statSync(path.join(map, name)).isFile()) throw new Error('missing graph file: ' + name);
    if (!inside(root, fs.realpathSync(path.join(map, name)))) throw new Error('graph file escapes target');
  }
  const rel = path.relative(root, map).split(path.sep).join('/') || '.';
  const tool = (name) => path.posix.join(rel, 'tools', name);
  const protocol = path.posix.join(rel, 'PROTOCOL.md');
  const block = [
    START, '## build2me — mandatory project execution protocol', '',
    'Scope: the whole project, not only the first task or a selection pilot.',
    'Read ' + protocol + ' before work. Local safety, permissions, human approvals,',
    'and project instructions remain authoritative; a passing gate cannot create approval.',
    '',
    '1. From the project root, run: node ' + tool('frontier.mjs') + ' --dir ' + quote(rel) + ' --json',
    '2. Read the actionable contract; search existing contracts/submissions before implementing.',
    '3. If the requested work is absent from the graph, add an audited contract and gate',
    '   (or revise the existing statement). An empty frontier is NOT permission to work off-map.',
    '4. Publish a version-bound submission; run: node ' + tool('verify.mjs') + ' --dir ' + quote(rel) + ' --json',
    '5. Read the new frontier before advancing. Do not infer stage completion from chat,',
    '   handoff files, worker lifecycle, or a separately edited task-status field.',
    '6. Keep merged contract semantics/submissions immutable; revise and repair dependents.',
    '   Represent required human signoff as an explicit dependency with real evidence.',
    '',
    'Check root adoption: node ' + tool('adopt.mjs') + ' . --graph ' + quote(rel) + ' --check',
    'Cloning build2me into a subdirectory alone does not adopt this protocol.',
    END,
  ].join('\n');
  const changes = [];
  const add = (relative, content, owned = false) => {
    const file = destination(root, relative);
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (owned && old !== null && old !== content) throw new Error('unowned adoption file conflict: ' + relative);
    if (old !== content) changes.push({ file, relative, content });
  };
  const seen = new Set();
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    if (name === 'CLAUDE.md' && !existsEntry(path.join(root, name))) continue;
    const file = destination(root, name);
    if (seen.has(file)) continue;
    seen.add(file);
    const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    add(name, merge(old, block));
  }
  add('.build2me.json', JSON.stringify({ schema_version: 1, graph: rel, protocol, scope: 'whole-project' }, null, 2) + '\n', true);
  const law = { id: 'root-entry-binding', dimension: 'execution-protocol',
    statement: 'The project-root rule entry must bind the entire project to this graph.',
    check: 'node tools/adopt.mjs ' + quote(path.relative(map, root).split(path.sep).join('/') || '.') +
      ' --graph ' + quote(rel) + ' --check' };
  const lawFile = path.join(map, 'laws/root-entry-binding.json');
  if (fs.existsSync(lawFile)) {
    const prior = JSON.parse(fs.readFileSync(lawFile, 'utf8'));
    if (prior.id !== law.id || prior.dimension !== law.dimension || prior.statement !== law.statement ||
        typeof prior.check !== 'string' || !prior.check.startsWith('node tools/adopt.mjs ')) {
      throw new Error('unowned root-entry-binding law conflict');
    }
  }
  add(path.relative(root, lawFile), JSON.stringify(law, null, 2) + '\n');
  return { root, graph: rel, changes };
}
export function applyIntegration(plan) {
  for (const change of plan.changes) {
    fs.mkdirSync(path.dirname(change.file), { recursive: true });
    fs.writeFileSync(change.file, change.content);
  }
}
