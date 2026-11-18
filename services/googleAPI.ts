import { FirebaseApp, initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, Auth } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let provider: GoogleAuthProvider | null = null;

try {
  if (firebaseConfig && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/sheets');
  }
} catch (err) {
  console.error("Firebase not configured", err);
}


// Lança um erro que inclui o status HTTP e a mensagem devolvida pela API do Google.
const throwApiError = async (res: Response, action: string): Promise<never> => {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error?.message ? `: ${body.error.message}` : '';
  } catch {
    // resposta sem JSON
  }
  throw new Error(`${action} (HTTP ${res.status})${detail}`);
};

// Codifica o intervalo (ex.: "Página1!A1") para uso seguro na URL.
const enc = (range: string) => encodeURIComponent(range);

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  if (!auth) {
    if (onAuthFailure) onAuthFailure();
    return () => {};
  }
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (!firebaseConfig.apiKey || !auth || !provider) {
     throw new Error("Firebase credentials are not configured. Please supply a valid firebase-applet-config.json file for Google Sign-In to work.");
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const logout = async () => {
  if (auth) {
    await auth.signOut();
  }
  cachedAccessToken = null;
};

export const createSpreadsheet = async (title: string) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: { title },
      // Nome fixo da aba: sem isso o Google usa o idioma da conta (Sheet1/Página1)
      // e as chamadas que usam "Página1!..." falham em contas em outro idioma.
      sheets: [{ properties: { title: 'Página1' } }]
    })
  });

  if (!res.ok) {
    await throwApiError(res, 'Falha ao criar a planilha');
  }

  return await res.json();
};

export const updateSpreadsheetData = async (spreadsheetId: string, range: string, values: any[][]) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${enc(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    await throwApiError(res, 'Falha ao atualizar a planilha');
  }

  return await res.json();
};

export const clearSpreadsheetRange = async (spreadsheetId: string, range: string) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${enc(range)}:clear`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    await throwApiError(res, 'Falha ao limpar a planilha');
  }

  return await res.json();
};

export const getSpreadsheetData = async (spreadsheetId: string, range: string) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${enc(range)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    await throwApiError(res, 'Falha ao ler a planilha');
  }

  return await res.json();
};

export const appendSpreadsheetRow = async (spreadsheetId: string, range: string, values: any[][]) => {
  const token = await getAccessToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${enc(range)}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values
    })
  });

  if (!res.ok) {
    await throwApiError(res, 'Falha ao adicionar linha na planilha');
  }

  return await res.json();
};
