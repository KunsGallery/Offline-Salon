const stubs = {
  '/src/lib/firebase.js': new URL('./stubs/firebase.mjs', import.meta.url).href,
  '/src/lib/auth.js': new URL('./stubs/auth.mjs', import.meta.url).href,
};

export async function resolve(specifier, context, nextResolve) {
  let result;
  try {
    result = await nextResolve(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') || /\.[a-z]+$/i.test(specifier)) throw error;
    result = await nextResolve(`${specifier}.js`, context);
  }
  const stub = Object.entries(stubs).find(([suffix]) => result.url.endsWith(suffix));
  return stub ? { url: stub[1], shortCircuit: true } : result;
}
