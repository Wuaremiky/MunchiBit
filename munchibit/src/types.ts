import type { Sex, Activity } from './lib/calc';
export type MealType = 'desayuno' | 'almuerzo' | 'cena' | 'snack';
export interface Profile {
  id: string; name: string | null; avatar_url: string | null; sex: Sex | null; age: number | null;
  height_cm: number | null; weight_kg: number | null; activity_level: Activity | null;
  goal_weight_kg: number | null; deficit_kcal: 250 | 500 | 750; add_exercise_calories: boolean;
  water_goal: number; bmr: number | null; tdee: number | null; daily_kcal: number | null;
  protein_g: number | null; carbs_g: number | null; fat_g: number | null; onboarded: boolean;
}
export interface Food {
  id: string; name: string; category: string | null; kcal_100g: number; protein_100g: number;
  carbs_100g: number; fat_100g: number; serving_g: number; serving_label: string;
  created_by: string | null; is_custom: boolean;
}
export interface MealLog {
  id: string; date: string; meal_type: MealType; food_id: string | null; food_name: string;
  quantity_g: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number;
}
export interface ExerciseLog { id: string; date: string; type: string; minutes: number; kcal_burned: number }
export interface WaterLog { date: string; glasses: number }
export interface WeightLog { date: string; weight_kg: number }
export interface Goal { effective_from: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }
export interface AppData {
  profile: Profile; meals: MealLog[]; exercise: ExerciseLog[]; water: WaterLog[];
  weights: WeightLog[]; goals: Goal[]; foods: Food[]; favorites: string[];
}
export interface Props { userId: string; data: AppData; reload: () => Promise<void> }
