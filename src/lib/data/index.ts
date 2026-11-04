import "server-only";
import { features } from "../env";
import { demoRepo } from "./demo";
import { supabaseRepo } from "./supabase";
import type { Repo } from "./repo";

/** Aktif veri sürücüsü: Supabase anahtarları varsa Supabase, yoksa bellek içi demo. */
export const repo: Repo = features.supabase ? supabaseRepo : demoRepo;
export const isDemoData = repo.kind === "demo";
export { StockError } from "./repo";
