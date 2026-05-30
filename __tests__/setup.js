import { plugin } from 'bun'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

// Set up the test environment exactly once. This runs both as a bunfig preload
// (in-package `bun test`) and as a normal import from each test file (so the
// suite also works when the monorepo runs `bun test` from the repo root, where
// the package-local preload does not apply).
if (!globalThis.__CS_TEST_ENV__) {
  globalThis.__CS_TEST_ENV__ = true

  // Provide a DOM for MutationObserver, customElements, HTMLElement, etc.
  if (typeof globalThis.document === 'undefined') {
    GlobalRegistrator.register()
  }

  // The entry (index.js) imports CSS for its side effects. Treat CSS as a no-op
  // module under the test runner so those imports do not break. Must be a
  // dynamic import in the test that needs it (the plugin only affects loads
  // that happen after this registration).
  plugin({
    name: 'css-noop',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }))
    },
  })
}
