// Hash de senhas com PBKDF2 (Web Crypto). Este app guarda os perfis no navegador,
// então o objetivo é, no mínimo, não deixar a senha em texto puro no localStorage.
// Para segurança real, a autenticação deve ficar em um servidor.

const PREFIX = 'pbkdf2';
const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const derive = async (password: string, salt: Uint8Array): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    // O Web Crypto só existe em HTTPS ou localhost.
    throw new Error('Criptografia indisponível: abra o app em HTTPS ou em localhost.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    key,
    HASH_BITS,
  );
  return toHex(new Uint8Array(bits));
};

export const isHashed = (stored: string | undefined): boolean =>
  !!stored && stored.startsWith(`${PREFIX}$`);

export const hashPassword = async (password: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return `${PREFIX}$${toHex(salt)}$${await derive(password, salt)}`;
};

/**
 * Compara a senha digitada com a armazenada.
 * Aceita senhas antigas em texto puro (`legacy: true`) para que quem já tem
 * conta consiga entrar; quem chamar deve regravá-las já com hash.
 */
export const verifyPassword = async (
  password: string,
  stored: string | undefined,
): Promise<{ ok: boolean; legacy: boolean }> => {
  if (!stored) return { ok: false, legacy: false };

  if (!isHashed(stored)) {
    return { ok: stored === password, legacy: true };
  }

  const [, saltHex, expected] = stored.split('$');
  if (!saltHex || !expected) return { ok: false, legacy: false };

  const actual = await derive(password, fromHex(saltHex));
  return { ok: actual === expected, legacy: false };
};
