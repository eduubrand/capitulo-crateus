// Escolhe qual "banco" usar: Supabase (se configurado) ou o modo demonstração.
// Abrir o site com "?demo" no endereço força o modo demonstração, mesmo com o
// Supabase configurado (útil para testar sem mexer nos dados reais).
import { CONFIG } from '../config.js';

const forcarDemo = new URLSearchParams(location.search).has('demo');
const usarSupabase = !forcarDemo && Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const mod = usarSupabase ? await import('./supabase.js') : await import('./local.js');

export const db = mod.db;
