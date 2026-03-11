-- Ensure thehickeyclan@gmail.com has admin role
UPDATE public.users
SET role = 'admin'
WHERE LOWER(TRIM(email)) = 'thehickeyclan@gmail.com';
