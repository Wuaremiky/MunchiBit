# MunchiBit — Guía de configuración

App de conteo de calorías con mascota, rachas y recomendaciones. Vite + React + TypeScript + Tailwind + Supabase.

## 1. Supabase
1. Crea un proyecto en https://supabase.com (plan gratis).
2. En **SQL Editor** ejecuta, en este orden: `supabase/schema.sql` y luego `supabase/seed.sql`.
3. En **Project Settings → API** copia la *Project URL* y la clave *anon public*.
4. En **Authentication → Providers → Email** déjalo activo (puedes desactivar "Confirm email" mientras pruebas).

## 2. Local
```bash
npm install
cp .env.example .env      # pega tu URL y anon key
npm run dev               # http://localhost:5173
npm test                  # tests del motor de cálculo y recomendaciones
npm run typecheck         # revisión de tipos (opcional)
```

## 3. GitHub
```bash
git init && git add . && git commit -m "MunchiBit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/munchibit.git   # crea antes el repo vacío llamado munchibit en github.com/new
git push -u origin main
```

## 4. Vercel
1. En https://vercel.com entra con GitHub → **Add New → Project** → importa `munchibit`.
2. Framework: **Vite** (se detecta solo). Build: `npm run build`, salida: `dist`.
3. En **Environment Variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. **Deploy**. Cada `git push` a `main` redespliega solo.

## 5. Volver a Supabase con la URL final
En **Authentication → URL Configuration**: pon la URL de Vercel en *Site URL* y agrégala en *Redirect URLs*.
Sin esto, el enlace de "Olvidé mi contraseña" no vuelve a tu app.

## Checklist de pruebas
- [ ] Registro, confirmación por correo e inicio de sesión
- [ ] Olvidé mi contraseña → llega el correo → pide nueva contraseña
- [ ] Onboarding completo y metas coherentes (mujer 60 kg, sedentaria, agresivo → 1.200 kcal con aviso)
- [ ] Registrar, borrar y marcar favorito un alimento; crear alimento propio
- [ ] Ejercicio suma al presupuesto solo si activas la opción en Perfil
- [ ] Agua +/− y racha
- [ ] Peso: gráfico y fecha estimada tras 3+ registros en 7+ días
- [ ] Editar Perfil recalcula metas y el historial no cambia
- [ ] Con 2 usuarios distintos, ninguno ve datos del otro (RLS)

## Notas
- El avatar es un emoji (se guarda como `emoji:🦝`). Para fotos habría que añadir Supabase Storage.
- Modo oscuro: no incluido en esta versión.
- Las recomendaciones son reglas locales (`src/lib/recommendations.ts`), listas para extender con IA.

## Registro por foto (opcional)
Usa una Edge Function de Supabase que llama a Claude (modelo Haiku 5.5). Límite: 4 fotos por usuario al día, aplicado en el servidor.

1. **Cuenta y saldo:** crea una cuenta en https://platform.claude.com, carga saldo (con $5 alcanza para miles de fotos con Haiku) y en la sección de claves de API crea una clave. En la consola puedes fijar un tope de gasto y dejar desactivada la recarga automática.
2. **SQL:** en el SQL Editor de Supabase ejecuta `supabase/photo_analysis.sql`.
3. **Función:** en Supabase → Edge Functions → *Deploy a new function* (editor), nómbrala exactamente `analyze-meal`, pega el contenido de `supabase/functions/analyze-meal/index.ts` y despliega. Déjala con la verificación de JWT activada.
4. **Secreto:** en Edge Functions → Secrets agrega `ANTHROPIC_API_KEY` con tu clave. (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya vienen incluidas; no las pegues en ningún otro sitio.)
5. Sube el código a GitHub como siempre. En Registrar aparecerá el botón "Registrar con una foto".

Con la CLI: `supabase functions deploy analyze-meal` y `supabase secrets set ANTHROPIC_API_KEY=...`.

Para cambiar el límite diario, edita `DAILY_LIMIT` en la función. Para usar un modelo más preciso, cambia `MODEL` (por ejemplo a `claude-sonnet-5-5`; cuesta unas 20 veces más por foto).
