-- Criar bucket para avatares dos usuarios
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Politica para permitir upload de avatar (usuario autenticado)
CREATE POLICY "Usuarios podem fazer upload do proprio avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Politica para permitir atualizacao do proprio avatar
CREATE POLICY "Usuarios podem atualizar proprio avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Politica para permitir deletar proprio avatar
CREATE POLICY "Usuarios podem deletar proprio avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Politica para permitir leitura publica dos avatares
CREATE POLICY "Avatares sao publicos para leitura"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
