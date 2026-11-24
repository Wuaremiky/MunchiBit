# MunchiBit — Fase 1: Arquitectura

## Decisión de stack
**Vite + React + TypeScript + Tailwind + Lucide + Recharts + Supabase.**
App SPA con sesión (sin SEO), así que Vite es más simple que Next.js. Despliegue gratis en Vercel/Netlify.

## Estructura de carpetas
```
munchibit/
├─ supabase/
│  ├─ schema.sql          # tablas, RLS, triggers
│  └─ seed.sql            # 60+ alimentos
├─ src/
│  ├─ lib/
│  │  ├─ supabase.ts      # cliente
│  │  ├─ calc.ts          # TMB, TDEE, macros, límites (puro)
│  │  └─ recommendations.ts  # motor de reglas (puro)
│  ├─ hooks/              # useProfile, useDayLog, useWeight...
│  ├─ components/
│  │  ├─ mascot/          # Mascot.tsx (SVG, estados)
│  │  ├─ dashboard/       # CalorieRing, MacroBars, WaterCounter, StreakBadge
│  │  ├─ log/             # FoodSearch, MealSection, ExerciseForm
│  │  ├─ progress/        # WeightChart, WeeklySummary
│  │  └─ ui/              # Card, Skeleton, BottomNav
│  ├─ pages/              # Auth, Onboarding, Today, Log, Progress, Profile
│  ├─ types.ts
│  └─ main.tsx
├─ .env.example
└─ tests/calc.test.ts     # Vitest
```

## Modelo de datos
| Tabla | Propósito |
|---|---|
| `profiles` | biometría, actividad, objetivo, déficit, preferencia de ejercicio, metas vigentes |
| `daily_goals` | meta por fecha de vigencia (conserva historial al recalcular) |
| `foods` | catálogo base (`created_by` null) + alimentos propios (`is_custom`) |
| `favorites` | alimentos favoritos por usuario |
| `meal_logs` | comidas con snapshot de kcal/macros |
| `exercise_logs` | actividad, minutos, kcal quemadas |
| `water_logs` | vasos por día |
| `weight_logs` | peso por fecha |

Reglas clave: todo con índice `(user_id, date)`; RLS en todas las tablas; el catálogo base es solo lectura pública; los registros guardan un snapshot, así que cambiar un alimento o las metas nunca altera el pasado.
