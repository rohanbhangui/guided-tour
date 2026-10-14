declare const process: { env: { NODE_ENV?: string } };

/** Bundlers replace `process.env.NODE_ENV` statically; guard for environments that don't. */
export const isDev = (() => {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
})();

export function warn(message: string) {
  if (isDev) console.warn(`[guided-tour] ${message}`);
}
