# Token Gen Site

This is the canonical deploy/source repo for `https://token-gen.owenonthenet.com`.

Before committing:

1. Verify the root with `git rev-parse --show-toplevel`.
2. Verify the remote with `git remote -v`.
3. Review `git status --short`.

Expected remote:

```text
https://github.com/owen-tech-ramblings/token-gen-site.git
```

Related paths:

- Windows source mirror: `/mnt/c/Users/User/Documents/New project/token-gen-site`
- Runtime API proxy: `/home/jesse/.openclaw/workspace/token-gen-api-proxy`

Commit and push public-site changes from this repo unless Jesse explicitly asks
for a different target. Mirror changes to the Windows source copy when useful,
but do not treat the mirror as the deploy authority by default.
