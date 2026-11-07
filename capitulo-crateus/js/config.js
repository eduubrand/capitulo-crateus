// =============================================================
// CONFIGURAÇÃO DO SITE
// -------------------------------------------------------------
// Deixe SUPABASE_URL vazio para rodar em MODO DEMONSTRAÇÃO
// (dados ficam salvos só no navegador, ótimo para testar).
//
// Para usar de verdade, crie um projeto grátis em https://supabase.com,
// rode o arquivo supabase/schema.sql e cole aqui a URL e a "anon key"
// (Project Settings > API). A anon key é PÚBLICA por design: quem
// protege os dados são as regras RLS do banco, não o segredo da chave.
// =============================================================
export const CONFIG = {
  SUPABASE_URL: 'https://aorehpnrwjktndvpfmpg.supabase.co',   // só o endereço do projeto, sem /rest/v1
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvcmVocG5yd2prdG5kdnBmbXBnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNjc5MjksImV4cCI6MjEwOTY0MzkyOX0.C2MBbdyH7L14PP5QEXBRKyTF916lWbZe5fRcY1Ew0Dk',

  // Login é feito por ID (ex.: "arthur" ou "12345"). Por baixo, o Supabase
  // precisa de um e-mail, então o ID vira "id@LOGIN_DOMINIO". Ninguém recebe
  // e-mail nesse endereço; ele só existe para o sistema. Se mudar aqui,
  // mude também a linha  v_dominio := 'crateus.app'  no supabase/schema.sql.
  LOGIN_DOMINIO: 'crateus.app',

  NOME_CAPITULO: 'Crateús',
  SUBTITULO: 'Ordem DeMolay · Secretaria',
};
