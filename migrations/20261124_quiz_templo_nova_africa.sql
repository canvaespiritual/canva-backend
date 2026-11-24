CREATE TABLE IF NOT EXISTS quiz_templo_nova_africa_contatos (
  id uuid PRIMARY KEY,
  email text,
  telefone text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR telefone IS NOT NULL)
);
