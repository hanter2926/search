# SEARCH contribution guidance

- Preserve the local/Supabase persistence boundary; never claim Supabase is active without configured credentials and a passing integration test.
- Enforce authorization in the API, not only in web or mobile clients.
- Reuse contracts from `packages/shared`.
- Add an integration test for each new authenticated workflow.
- Do not mark visual work verified without opening the rendered page.
- Keep external provider requirements explicit in `DEVELOPMENT_PROGRESS.md` and `KNOWN_ISSUES.md`.
