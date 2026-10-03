#!/usr/bin/env node
// Bind an existing graph to the actual project-root rule entry.
// Preview by default. --apply merges; --check fails on missing/drifted adoption.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { planIntegration, applyIntegration } from './integration.mjs';

export function main(args = process.argv.slice(2)) {
  const usage = 'node tools/adopt.mjs <project-root> [--graph <relative-dir>] [--apply | --check]';
  try {
    let target = null, graph = '.', mode = 'preview';
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '--help' || a === '-h') { console.log(usage); return 0; }
      if (a === '--graph') {
        graph = args[++i];
        if (!graph || graph.startsWith('--')) throw new Error('--graph needs a value');
      } else if (a === '--apply' || a === '--check') {
        if (mode !== 'preview') throw new Error('choose exactly one mode');
        mode = a.slice(2);
      } else if (a.startsWith('-') || target !== null) throw new Error('unexpected argument: ' + a);
      else target = path.resolve(a);
    }
    if (!target) throw new Error(usage);
    const git = spawnSync('git', ['-C', target, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
    if (git.status === 0 && fs.realpathSync(git.stdout.trim()) !== fs.realpathSync(target)) {
      throw new Error('target must be the actual Git project root: ' + git.stdout.trim());
    }
    const map = path.resolve(target, graph);
    const plan = planIntegration(target, map);
    // Existing-graph adoption copies only its own checked-in binding tools.
    for (const name of ['adopt.mjs', 'integration.mjs']) {
      const source = new URL(name, import.meta.url);
      const dest = path.join(map, 'tools', name);
      const content = fs.readFileSync(source);
      if (fs.existsSync(dest)) {
        if (!fs.readFileSync(dest).equals(content)) throw new Error('binding tool conflict: ' + dest);
      } else plan.changes.unshift({ file: dest, relative: path.relative(target, dest), content });
    }
    if (mode === 'check' && plan.changes.length) throw new Error('adoption incomplete or drifted: ' + plan.changes.map(x => x.relative).join(', '));
    if (mode === 'apply') applyIntegration(plan);
    console.log(JSON.stringify({ mode, project_root: plan.root, graph: plan.graph, changed: plan.changes.map(x => x.relative) }, null, 2));
    return 0;
  } catch (error) {
    console.error('adopt: ' + error.message);
    return 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
