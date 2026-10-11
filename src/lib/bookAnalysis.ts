import { supabase } from "@/integrations/supabase/client";

export type BookAnalysisMethod = "headings" | "page-ranges" | "estimated";
export interface BookAnalysis {
  units: string[];
  pageCount: number;
  method: BookAnalysisMethod;
  message?: string;
}

type AnalysisRow = {
  book_id: string;
  units: unknown;
  page_count: number;
  method: BookAnalysisMethod;
  message: string | null;
};

export async function loadBookAnalyses(userId: string): Promise<Record<string, BookAnalysis>> {
  const { data, error } = await supabase
    .from("academic_book_analyses")
    .select("book_id,units,page_count,method,message")
    .eq("user_id", userId);
  if (error) throw error;
  const result: Record<string, BookAnalysis> = {};
  for (const row of (data || []) as AnalysisRow[]) {
    const units = Array.isArray(row.units) ? row.units.filter((unit): unit is string => typeof unit === "string") : [];
    result[row.book_id] = {
      units,
      pageCount: Math.max(0, Number(row.page_count) || 0),
      method: row.method,
      ...(row.message ? { message: row.message } : {}),
    };
  }
  return result;
}

export async function saveBookAnalyses(userId: string, analyses: Record<string, BookAnalysis>): Promise<void> {
  const rows = Object.entries(analyses).map(([book_id, analysis]) => ({
    user_id: userId,
    book_id,
    units: analysis.units,
    page_count: analysis.pageCount,
    method: analysis.method,
    message: analysis.message || null,
    analyzed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await supabase.from("academic_book_analyses").upsert(rows, { onConflict: "user_id,book_id" });
  if (error) throw error;
}
