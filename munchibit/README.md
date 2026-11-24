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
