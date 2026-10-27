export interface Policy {
  thresholdTokens: number; targetTokens: number; recentExchanges: number;
  summaryChars: number; maxPayloadBytes: number;
  literals: string[]; redactEmails: boolean; redactIPv4: boolean;
}
export const defaults: Policy = {
  thresholdTokens: 24000, targetTokens: 16000, recentExchanges: 4,
  summaryChars: 4000, maxPayloadBytes: 8_000_000,
  literals: [], redactEmails: true, redactIPv4: false,
};
export class GuardError extends Error {
  constructor() { super('Context reviewer blocked request: policy, payload, or budget could not be safely validated.'); this.name = 'GuardError'; }
}
export function policy(input: unknown): Policy {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new GuardError();
  const obj = input as Record<string, unknown>;
  if (Object.keys(obj).some(k => !(k in defaults))) throw new GuardError();
  const p = { ...defaults, ...obj } as Policy;
  for (const k of ['thresholdTokens','targetTokens','recentExchanges','summaryChars','maxPayloadBytes'] as const)
    if (!Number.isSafeInteger(p[k]) || p[k] < 1) throw new GuardError();
  if (p.targetTokens >= p.thresholdTokens || p.recentExchanges > 100 || p.summaryChars > 100000 || p.maxPayloadBytes > 50_000_000) throw new GuardError();
  if (!Array.isArray(p.literals) || p.literals.some(x => typeof x !== 'string' || x.length < 3) || p.literals.length > 1000) throw new GuardError();
  if (typeof p.redactEmails !== 'boolean' || typeof p.redactIPv4 !== 'boolean') throw new GuardError();
  return p;
}
