import { Plugin } from '@opencode/plugin';
import { Guard } from './guard.js';
import { GuardError } from './policy.js';

export default Plugin.define({
  id: 'context-reviewer',
  async setup(ctx) {
    const guard = new Guard(ctx.options);
    const registrations: Array<{dispose(): Promise<void>}> = [];
    try {
      for (const name of ['context','generate','title','compaction'] as const)
        registrations.push(await ctx.session.hook(name, event => guard.transform(event, name !== 'compaction')));
      // Last-mile native HTTP validation catches raw overlays and later hook additions.
      registrations.push(await ctx.session.hook('http.request', event => guard.inspectHTTP(event.request)));
      // Opaque state/deltas cannot be fully inspected; default to refusing this transport.
      registrations.push(await ctx.session.hook('experimental.ws.handshake', () => { throw new GuardError(); }));
      return async () => { for (const r of registrations.reverse()) await r.dispose(); };
    } catch {
      for (const r of registrations.reverse()) await r.dispose();
      throw new GuardError();
    }
  },
});
