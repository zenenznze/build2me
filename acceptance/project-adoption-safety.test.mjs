import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const call = (tool, args) => spawnSync('node', [path.join(repo, 'tools', tool), ...args], { encoding: 'utf8' });
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'b2m-safe-'));
  assert.equal(call('init.mjs', [path.join(root, 'map'), '--root', 'demo']).status, 0);
  return root;
}
test('dangling rule links cannot create an outside file', () => {
  const root = fixture(), outside = fs.mkdtempSync(path.join(os.tmpdir(), 'b2m-out-'));
  const dest = path.join(outside, 'not-created.md');
  fs.symlinkSync(dest, path.join(root, 'AGENTS.md'));
  assert.notEqual(call('adopt.mjs', [root, '--graph', 'map', '--apply']).status, 0);
  assert.equal(fs.existsSync(dest), false);
  assert.equal(fs.existsSync(path.join(root, '.build2me.json')), false);
  fs.rmSync(root, { recursive: true, force: true });fs.rmSync(outside, { recursive: true, force: true });
});
test('adoption rejects a Git subdirectory instead of silently binding the wrong root', () => {
  const root = fixture();
  assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
  const r = call('adopt.mjs', [path.join(root, 'map'), '--check']);
  assert.notEqual(r.status, 0);assert.match(r.stderr, /actual Git project root/);
  fs.rmSync(root, { recursive: true, force: true });
});
test('internal CLAUDE alias is preserved and written once', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '# local rules\n');
  fs.symlinkSync('AGENTS.md', path.join(root, 'CLAUDE.md'));
  assert.equal(call('adopt.mjs', [root, '--graph', 'map', '--apply']).status, 0);
  const content = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
  assert.equal(content.split('<!-- BUILD2ME:START -->').length, 2);
  assert.equal(fs.readlinkSync(path.join(root, 'CLAUDE.md')), 'AGENTS.md');
  fs.rmSync(root, { recursive: true, force: true });
});
test('malformed root entry is refused by forced init before scaffolding writes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'b2m-refuse-'));
  fs.writeFileSync(path.join(root, 'AGENTS.md'), '<!-- BUILD2ME:END -->');
  assert.notEqual(call('init.mjs', [root, '--root', 'demo', '--force']).status, 0);
  assert.deepEqual(fs.readdirSync(root), ['AGENTS.md']);
  fs.rmSync(root, { recursive: true, force: true });
});
