// Escolhe qual "banco" usar: Supabase (se configurado) ou o modo demonstração.
import { CONFIG } from '../config.js';

const usarSupabase = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const mod = usarSupabase ? await import('./supabase.js') : await import('./local.js');

export const db = mod.db;
