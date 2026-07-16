import globalSetup from './global-setup';

/**
 * Thin synchronous-from-the-outside runner for `global-setup.ts`'s async
 * bootstrap. `playwright.config.ts` invokes this file via `execFileSync`
 * (blocking) at module-evaluation time — see that file's doc comment for
 * why Playwright's own `globalSetup:` config field cannot be used for this
 * suite's bootstrap (its `webServer` plugin starts before any user
 * `globalSetup` file runs, which is too late for `apps/inventory`, whose
 * process pings its database synchronously at boot).
 */
globalSetup()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
