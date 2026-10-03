
<!-- BUILD2ME:START -->
## build2me — mandatory project execution protocol

Scope: the whole project, not only the first task or a selection pilot.
Read PROTOCOL.md before work. Local safety, permissions, human approvals,
and project instructions remain authoritative; a passing gate cannot create approval.

1. From the project root, run: node tools/frontier.mjs --dir '.' --json
2. Read the actionable contract; search existing contracts/submissions before implementing.
3. If the requested work is absent from the graph, add an audited contract and gate
   (or revise the existing statement). An empty frontier is NOT permission to work off-map.
4. Publish a version-bound submission; run: node tools/verify.mjs --dir '.' --json
5. Read the new frontier before advancing. Do not infer stage completion from chat,
   handoff files, worker lifecycle, or a separately edited task-status field.
6. Keep merged contract semantics/submissions immutable; revise and repair dependents.
   Represent required human signoff as an explicit dependency with real evidence.

Check root adoption: node tools/adopt.mjs . --graph '.' --check
Cloning build2me into a subdirectory alone does not adopt this protocol.
<!-- BUILD2ME:END -->
