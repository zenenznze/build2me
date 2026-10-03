import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const repo = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const call = (file, args) => spawnSync('node', [path.join(repo, 'tools', file), ...args], { encoding: 'utf8' });
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build2me-adopt-'));
  const graph = path.join(root, 'work/map');
  assert.equal(call('init.mjs', [graph, '--root', 'demo']).status, 0);
  return { root, graph };
}
test('adoption tool exists before assertions against its exit code', () => {
  assert.ok(fs.existsSync(path.join(repo, 'tools/adopt.mjs')));
});
test('preview is read-only; apply preserves project rules and covers all stages', () => {
  const { root } = fixture();
  const rules = '# User rules\nDo not publish or auto-approve.\n';
  fs.writeFileSync(path.join(root, 'AGENTS.md'), rules);
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), '# Client-specific rules\n');
  const args = [root, '--graph', 'work/map'];
  assert.equal(call('adopt.mjs', args).status, 0);
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), rules);
  assert.equal(fs.existsSync(path.join(root, '.build2me.json')), false);
  assert.notEqual(call('adopt.mjs', [...args, '--check']).status, 0);
  assert.equal(call('adopt.mjs', [...args, '--apply']).status, 0);
  const applied = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.ok(applied.startsWith(rules));
  assert.match(applied, /whole project/);
  assert.match(applied, /empty frontier is NOT permission/);
  assert.match(applied, /work\/map\/PROTOCOL.md/);
  assert.match(fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8'), /BUILD2ME:START/);
  assert.equal(call('adopt.mjs', [...args, '--check']).status, 0);
  assert.equal(call('adopt.mjs', [...args, '--apply']).status, 0);
  assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), applied);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), rules);
  assert.notEqual(call('adopt.mjs', [...args, '--check']).status, 0);
  fs.rmSync(root, { recursive: true, force: true });
});
test('external graph, escaped rule links and malformed markers fail before writes', () => {
  const { root, graph } = fixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'build2me-outside-'));
  const file = path.join(outside, 'AGENTS.md');
  fs.writeFileSync(file, 'private rules');
  fs.symlinkSync(file, path.join(root, 'AGENTS.md'));
  const args = [root, '--graph', 'work/map', '--apply'];
  assert.notEqual(call('adopt.mjs', args).status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), 'private rules');
  assert.equal(fs.existsSync(path.join(root, '.build2me.json')), false);
  fs.unlinkSync(path.join(root, 'AGENTS.md'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '<!-- BUILD2ME:START --> broken');
  assert.notEqual(call('adopt.mjs', args).status, 0);
  assert.equal(fs.existsSync(path.join(root, '.build2me.json')), false);
  assert.notEqual(call('adopt.mjs', [outside, '--graph', graph, '--apply']).status, 0);
  fs.rmSync(root, { recursive: true, force: true });fs.rmSync(outside, { recursive: true, force: true });
});
test('a fresh init binds its own root entry and the law rejects removed binding', () => {
  const { root, graph } = fixture();
  assert.ok(fs.existsSync(path.join(graph, 'AGENTS.md')), 'init must install the root rule entry');
  assert.match(fs.readFileSync(path.join(graph, 'AGENTS.md'), 'utf8'), /BUILD2ME:START/);
  const law = JSON.parse(fs.readFileSync(path.join(graph, 'laws/root-entry-binding.json'), 'utf8'));
  const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('NODE_TEST_')));
  assert.equal(spawnSync(law.check, { cwd: graph, shell: true, env: cleanEnv }).status, 0);
  fs.writeFileSync(path.join(graph, 'AGENTS.md'), '# detached rules\n');
  assert.notEqual(spawnSync(law.check, { cwd: graph, shell: true, env: cleanEnv }).status, 0);
  fs.rmSync(root, { recursive: true, force: true });
});
