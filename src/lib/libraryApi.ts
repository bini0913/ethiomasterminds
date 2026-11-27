import { supabase } from '@/integrations/supabase/client';

export type UploadStatus = 'pending' | 'approved' | 'rejected';

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  subject: string;
  description: string;
  grade_level: number | null;
  type: 'textbook' | 'notes' | 'practice' | 'reference';
  book_category: 'academic' | 'general';
  status: UploadStatus;
  pdf_path: string;
  thumbnail_path: string | null;
  uploader_id: string;
  uploader_role: 'student' | 'teacher' | 'admin' | 'manager';
  created_at: string;
  updated_at: string;
  download_count: number;
  profiles?: {
    name: string;
    username: string | null;
  } | null;
}

export interface ReaderHighlight {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number;
  selected_text: string;
  highlight_color: 'yellow' | 'blue' | 'red';
  note: string | null;
  created_at: string;
}

export interface GeneratedQuestion {
  id: string;
  user_id: string;
  book_id: string;
  page_number: number;
  question: string;
  answer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  source_excerpt: string;
  created_at: string;
}

export interface AIContentEntry {
  id: string;
  user_id: string;
  book_id: string;
  action: 'summary' | 'simple' | 'questions' | 'flashcards' | 'concepts';
  source_hash: string;
  source_excerpt: string;
  response: string;
  created_at: string;
}

export interface BookUpload {
  id: string;
  book_id: string;
  uploader_id: string;
  status: UploadStatus;
  moderation_note: string | null;
  moderated_by: string | null;
  moderated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReadingProgressEntry {
  id: string;
  user_id: string;
  book_id: string;
  last_page: number;
  completion_percent: number;
  time_spent_seconds: number;
}

export interface CreateBookPayload {
  title: string;
  author: string;
  subject: string;
  description: string;
  gradeLevel: number | null;
  type: LibraryBook['type'];
  bookCategory: LibraryBook['book_category'];
  pdfFile: File;
  uploaderId: string;
  uploaderRole: LibraryBook['uploader_role'];
  schoolSubmission?: { schoolId: string; sectionId: string };
  onProgress?: (state: 'validating' | 'uploading' | 'saving' | 'done') => void;
}

const db = supabase as any;

type UploaderProfile = NonNullable<LibraryBook['profiles']>;

async function fetchUploaderProfiles(uploaderIds: string[]) {
  const ids = Array.from(new Set(uploaderIds.filter(Boolean)));
  if (!ids.length) return new Map<string, UploaderProfile>();

  const { data, error } = await db
    .from('profiles')
    .select('id, name, username')
    .in('id', ids);

  if (error) throw error;

  return new Map<string, UploaderProfile>(
    ((data || []) as Array<{ id: string; name: string; username: string | null }>).map((profile) => [
      profile.id,
      { name: profile.name, username: profile.username },
    ]),
  );
}

async function withUploaderProfiles<T extends { uploader_id: string }>(rows: T[]) {
  if (!rows.length) {
    return rows.map((row) => ({ ...row, profiles: null as UploaderProfile | null }));
  }

  try {
    const profileMap = await fetchUploaderProfiles(rows.map((row) => row.uploader_id));
    return rows.map((row) => ({
      ...row,
      profiles: profileMap.get(row.uploader_id) ?? null,
    }));
  } catch (error) {
    console.warn('Library profile enrichment failed:', error);
    return rows.map((row) => ({
      ...row,
      profiles: null as UploaderProfile | null,
    }));
  }
}

async function withUploaderProfile<T extends { uploader_id: string }>(row: T) {
  const [enriched] = await withUploaderProfiles([row]);
  return enriched;
}

async function cleanupUploadedAssets(pdfPath: string, thumbnailPath: string | null) {
  const cleanupTasks = [
    supabase.storage.from('library-files').remove([pdfPath]),
    ...(thumbnailPath ? [supabase.storage.from('library-thumbnails').remove([thumbnailPath])] : []),
  ];

  const results = await Promise.allSettled(cleanupTasks);
  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn('Library upload cleanup failed:', result.reason);
      return;
    }

    if (result.value.error) {
      console.warn('Library upload cleanup failed:', result.value.error);
    }
  });
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: string }).code) : undefined;
}

export async function listBooks(options?: { includePending?: boolean; userId?: string }) {
  const includePending = options?.includePending ?? false;
  const userId = options?.userId;

  let query = db
    .from('library_books')
    .select('*')
    .order('created_at', { ascending: false });

  if (includePending) {
    // no additional filters
  } else if (userId) {
    query = query.or(`status.eq.approved,uploader_id.eq.${userId}`);
  } else {
    query = query.eq('status', 'approved');
  }

  const { data, error } = await query;
  if (error) throw error;
  return await withUploaderProfiles((data || []) as LibraryBook[]);
}

export async function listAssignedBooks(userId: string) {
  const { data, error } = await db
    .from('book_permissions')
    .select('book_id, library_books!inner(*)')
    .eq('user_id', userId)
    .eq('can_read', true)
    .eq('library_books.status', 'approved');

  if (error) throw error;
  const books = (data || []).map((row: any) => row.library_books).filter(Boolean) as LibraryBook[];
  return await withUploaderProfiles(books);
}

async function generatePdfThumbnail(pdfFile: File): Promise<Blob | null> {
  try {
    const pdfjs = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs' as any);
    (pdfjs as any).GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';

    const bytes = await pdfFile.arrayBuffer();
    const loadingTask = (pdfjs as any).getDocument({ data: bytes });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);

    const viewport = page.getViewport({ scale: 1.3 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.9);
    });
  } catch (error) {
    console.warn('PDF thumbnail generation failed:', error);
    return null;
  }
}

export async function createBook(payload: CreateBookPayload) {
  payload.onProgress?.('validating');
  if (!payload.pdfFile) {
    throw new Error('No file selected.');
  }

  const hasPdfMime = payload.pdfFile.type === "application/pdf";
  const hasPdfExtension = /\.pdf$/i.test(payload.pdfFile.name);
  const pdfHeader = await payload.pdfFile.slice(0, 1024).text();
  if ((!hasPdfMime && !hasPdfExtension) || !pdfHeader.includes("%PDF-")) {
    throw new Error("Choose a valid PDF file. The file content must contain a PDF header.");
  }

  const maxPdfSizeBytes = 50 * 1024 * 1024;
  if (payload.pdfFile.size > maxPdfSizeBytes) {
    throw new Error('File too large. Please upload a PDF smaller than 50MB.');
  }

  const baseName = `${Date.now()}-${crypto.randomUUID()}`;
  const pdfPath = `${payload.uploaderId}/${baseName}.pdf`;

  payload.onProgress?.('uploading');
  const { error: uploadError } = await supabase.storage
    .from('library-files')
    .upload(pdfPath, payload.pdfFile, { upsert: false, contentType: 'application/pdf' });

  if (uploadError) {
    if (uploadError.message?.toLowerCase().includes('network')) {
      throw new Error('Network error while uploading file. Please try again.');
    }
    throw new Error(uploadError.message || 'Upload failed, try again.');
  }

  let thumbnailPath: string | null = null;
  const thumbnailBlob = await generatePdfThumbnail(payload.pdfFile);

  if (thumbnailBlob) {
    thumbnailPath = `${payload.uploaderId}/${baseName}.png`;
    const { error: thumbnailError } = await supabase.storage
      .from('library-thumbnails')
      .upload(thumbnailPath, thumbnailBlob, { upsert: true, contentType: 'image/png' });

    if (thumbnailError) {
      console.warn('Thumbnail upload failed:', thumbnailError);
      thumbnailPath = null;
    }
  }

  const status: UploadStatus = payload.schoolSubmission
    ? 'pending'
    : payload.uploaderRole === 'teacher' || payload.uploaderRole === 'admin' || payload.uploaderRole === 'manager'
      ? 'approved'
      : 'pending';

  payload.onProgress?.('saving');
  const { data, error } = await db
    .from('library_books')
    .insert({
      title: payload.title,
      author: payload.author,
      subject: payload.subject,
      description: payload.description,
      grade_level: payload.gradeLevel,
      type: payload.type,
      book_category: payload.bookCategory,
      status,
      pdf_path: pdfPath,
      thumbnail_path: thumbnailPath,
      uploader_id: payload.uploaderId,
      uploader_role: payload.uploaderRole,
    })
    .select('*')
    .single();

  if (error) {
    await cleanupUploadedAssets(pdfPath, thumbnailPath);
    throw error;
  }

  const createdBook = await withUploaderProfile(data as LibraryBook);

  try {
    const { error: insertUploadError } = await db.from("book_uploads").insert({
      book_id: createdBook.id,
      uploader_id: payload.uploaderId,
      status,
      moderated_at: status === "approved" ? new Date().toISOString() : null,
      moderation_note: status === "approved" ? "Auto-approved by role policy" : "Awaiting teacher/admin moderation",
    });

    if (insertUploadError) {
      const code = getErrorCode(insertUploadError);
      if (code === "23505") {
        const { error: updateUploadError } = await db
          .from("book_uploads")
          .update({
            status,
            moderated_at: status === "approved" ? new Date().toISOString() : null,
            moderation_note: status === "approved" ? "Auto-approved by role policy" : "Awaiting teacher/admin moderation",
          })
          .eq("book_id", createdBook.id);
        if (updateUploadError) throw updateUploadError;
      } else {
        throw insertUploadError;
      }
    }
  } catch (uploadAuditError) {
    const { error: rollbackError } = await db.from("library_books").delete().eq("id", createdBook.id);
    if (!rollbackError) {
      await cleanupUploadedAssets(pdfPath, thumbnailPath);
    } else {
      console.error("Library upload rollback failed; preserving file to avoid a broken book record.", rollbackError);
    }
    throw new Error(
      rollbackError
        ? "The upload could not be finalized or safely rolled back. Please contact support before retrying."
        : uploadAuditError instanceof Error
          ? `The upload audit record could not be saved: ${uploadAuditError.message}`
          : "The upload audit record could not be saved.",
    );
  }

  if (payload.schoolSubmission) {
    const { error: schoolSubmitError } = await (supabase as any).rpc('school_submit_library_book', {
      p_book_id: createdBook.id,
      p_section_id: payload.schoolSubmission.sectionId,
    });
    if (schoolSubmitError) {
      const { error: rollbackError } = await db.from("library_books").delete().eq("id", createdBook.id);
      if (!rollbackError) await cleanupUploadedAssets(pdfPath, thumbnailPath);
      else console.error("School submission rollback failed; preserving file to avoid a broken book record.", rollbackError);
      throw new Error(
        rollbackError
          ? "School submission failed and the upload could not be safely rolled back. Please contact support."
          : `File upload was rolled back because school submission failed: ${schoolSubmitError.message}`,
      );
    }
    const { data: schoolBook, error: schoolBookError } = await db
      .from('library_books')
      .select('*')
      .eq('id', createdBook.id)
      .single();
    if (schoolBookError) {
      const { error: rollbackError } = await db.from("library_books").delete().eq("id", createdBook.id);
      if (!rollbackError) await cleanupUploadedAssets(pdfPath, thumbnailPath);
      else console.error("School book readback rollback failed; preserving file to avoid a broken book record.", rollbackError);
      throw schoolBookError;
    }
    payload.onProgress?.('done');
    return await withUploaderProfile(schoolBook as LibraryBook);
  }

  payload.onProgress?.('done');
  return createdBook;
}

export async function updateBook(id: string, patch: Partial<Pick<LibraryBook, 'title' | 'author' | 'subject' | 'description' | 'grade_level' | 'type' | 'book_category' | 'status'>>) {
  const { data, error } = await db
    .from('library_books')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return await withUploaderProfile(data as LibraryBook);
}

export async function moderateBookUpload(payload: {
  bookId: string;
  moderatorId: string;
  status: UploadStatus;
  note?: string;
}) {
  const { error: bookError } = await db
    .from('library_books')
    .update({ status: payload.status })
    .eq('id', payload.bookId);
  if (bookError) throw bookError;

  const { data: existing, error: existingError } = await db
    .from('book_uploads')
    .select('id')
    .eq('book_id', payload.bookId)
    .order('created_at', { ascending: false })
    .limit(1);
  if (existingError) throw existingError;

  const { data: bookRow } = await db
    .from('library_books')
    .select('uploader_id')
    .eq('id', payload.bookId)
    .single();

  if (existing?.[0]?.id) {
    const { error } = await db
      .from('book_uploads')
      .update({
        status: payload.status,
        moderated_by: payload.moderatorId,
        moderated_at: new Date().toISOString(),
        moderation_note: payload.note || null,
      })
      .eq('id', existing[0].id);
    if (error) throw error;
  } else {
    const { error } = await db
      .from('book_uploads')
      .insert({
        book_id: payload.bookId,
        uploader_id: bookRow?.uploader_id ?? payload.moderatorId,
        status: payload.status,
        moderated_by: payload.moderatorId,
        moderated_at: new Date().toISOString(),
        moderation_note: payload.note || null,
      });
    if (error) throw error;
  }
}

export async function deleteBook(id: string) {
  const { error } = await db.from('library_books').delete().eq('id', id);
  if (error) throw error;
}

export async function toggleBookmark(bookId: string, userId: string, currentlyBookmarked: boolean) {
  if (currentlyBookmarked) {
    const { error } = await db
      .from('library_bookmarks')
      .delete()
      .eq('book_id', bookId)
      .eq('user_id', userId);

    if (error) throw error;
    return false;
  }

  const { error } = await db
    .from('library_bookmarks')
    .insert({ book_id: bookId, user_id: userId });

  if (error) throw error;
  return true;
}

export async function listBookmarks(userId: string) {
  const { data, error } = await db
    .from('library_bookmarks')
    .select('book_id')
    .eq('user_id', userId);

  if (error) throw error;
  return new Set<string>((data || []).map((entry: { book_id: string }) => entry.book_id));
}

export async function listHighlights(userId: string, bookId?: string) {
  let query = db.from('highlights').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (bookId) query = query.eq('book_id', bookId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as ReaderHighlight[];
}

export async function createHighlight(payload: Omit<ReaderHighlight, 'id' | 'created_at'>) {
  const { data, error } = await db.from('highlights').insert(payload).select('*').single();
  if (error) throw error;
  return data as ReaderHighlight;
}

export async function listGeneratedQuestions(userId: string, bookId?: string) {
  let query = db.from('ai_generated_questions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (bookId) query = query.eq('book_id', bookId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as GeneratedQuestion[];
}

export async function saveGeneratedQuestions(entries: Omit<GeneratedQuestion, 'id' | 'created_at'>[]) {
  if (!entries.length) return [] as GeneratedQuestion[];
  const { data, error } = await db.from('ai_generated_questions').insert(entries).select('*');
  if (error) throw error;
  return (data || []) as GeneratedQuestion[];
}

export async function upsertReadingProgress(payload: Omit<ReadingProgressEntry, 'id'>) {
  const { data, error } = await db
    .from('reading_progress')
    .upsert(payload, { onConflict: 'book_id,user_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data as ReadingProgressEntry;
}

export async function listReadingProgress(userId: string) {
  const { data, error } = await db.from('reading_progress').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data || []) as ReadingProgressEntry[];
}

export async function findCachedAIContent(payload: Pick<AIContentEntry, 'user_id' | 'book_id' | 'action' | 'source_hash'>) {
  const { data, error } = await db
    .from('ai_content')
    .select('*')
    .match(payload)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as AIContentEntry | null;
}

export async function saveAIContent(entry: Omit<AIContentEntry, 'id' | 'created_at'>) {
  const { data, error } = await db.from('ai_content').insert(entry).select('*').single();
  if (error) throw error;
  return data as AIContentEntry;
}

export async function invokeLibraryAI(payload: {
  action: AIContentEntry['action'];
  text: string;
  grade: number;
  subject?: string;
}) {
  const { data, error } = await supabase.functions.invoke('library-ai', { body: payload });
  if (error) throw new Error(error.message || 'AI request failed.');
  if (!data?.response) throw new Error('AI returned no response.');
  return data.response as string;
}

export async function downloadBookPdf(path: string, fileName: string): Promise<void> {
  if (!path) throw new Error("This book does not have a downloadable PDF.");

  let file: Blob;
  if (/^https?:\/\//i.test(path)) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Download failed (${response.status}).`);
    file = await response.blob();
  } else {
    const normalizedPath = path.replace(/^\/+/, "");
    const { data, error } = await supabase.storage.from("library-files").download(normalizedPath);
    if (error) throw new Error(error.message || "Could not download this PDF.");
    if (!data) throw new Error("The storage service returned an empty file.");
    file = data;
  }

  if (!file.size) throw new Error("The downloaded PDF is empty.");
  const header = await file.slice(0, 1024).text();
  if (!header.includes("%PDF-")) throw new Error("The stored file is not a readable PDF.");

  const safeBaseName = fileName
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\.pdf$/i, "")
    .slice(0, 120) || "master-minds-book";
  const objectUrl = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${safeBaseName}.pdf`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}


async function loadPdfJs() {
  const sources = [
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs",
    "https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.min.mjs",
  ];
  let pdfjs: any = null;
  let workerSource = "";
  for (const source of sources) {
    try {
      pdfjs = await import(/* @vite-ignore */ source);
      workerSource = source.replace("pdf.min.mjs", "pdf.worker.min.mjs");
      break;
    } catch (error) {
      console.warn("PDF.js source unavailable; trying fallback:", error);
    }
  }
  if (!pdfjs) throw new Error("PDF reading tools could not load. Check your connection and retry.");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSource;
  return pdfjs;
}

export async function extractBookText(
  path: string,
  options?: { maxPages?: number; maxChars?: number },
): Promise<{ text: string; pageCount: number; pagesRead: number; truncated: boolean }> {
  if (!path) throw new Error("This book does not have a readable PDF file.");
  let file: Blob;
  if (/^https?:\/\//i.test(path)) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not retrieve the PDF (${response.status}).`);
    file = await response.blob();
  } else {
    const { data, error } = await supabase.storage.from("library-files").download(path.replace(/^\/+/, ""));
    if (error) throw new Error(error.message || "Could not retrieve the PDF.");
    if (!data) throw new Error("The PDF file is empty.");
    file = data;
  }
  if (!file.size) throw new Error("The PDF file is empty.");
  const header = await file.slice(0, 1024).text();
  if (!header.includes("%PDF-")) throw new Error("The stored file is not a valid PDF.");

  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Number(pdf.numPages) || 0;
  const maxPages = Math.max(1, Math.min(120, Math.floor(options?.maxPages ?? 20)));
  const maxChars = Math.max(500, Math.min(20_000, Math.floor(options?.maxChars ?? 12_000)));
  const pagesToRead = Math.min(pageCount, maxPages);
  const chunks: string[] = [];
  let length = 0;
  let pagesRead = 0;
  try {
    for (let pageNo = 1; pageNo <= pagesToRead && length < maxChars; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const content = await page.getTextContent();
      const pageText = (content.items || [])
        .map((item: any) => String(item.str || "").trim())
        .filter(Boolean)
        .join(" ");
      if (pageText) {
        chunks.push(`Page ${pageNo}: ${pageText}`);
        length += pageText.length;
      }
      pagesRead = pageNo;
    }
  } finally {
    if (typeof pdf.destroy === "function") await pdf.destroy();
  }
  const text = chunks.join("\n\n").slice(0, maxChars).trim();
  if (!text) throw new Error("No selectable text was found. This PDF may be scanned; OCR is needed before AI study tools can read it.");
  return { text, pageCount, pagesRead, truncated: pageCount > pagesRead || length > maxChars };
}

export async function analyzeBookPdf(
  path: string,
  unitsPerBook = 12,
): Promise<{ units: string[]; pageCount: number; method: "headings" | "page-ranges" | "estimated"; message?: string }> {
  if (!path) throw new Error("This book does not have a readable PDF file.");
  let file: Blob;
  if (/^https?:\/\//i.test(path)) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Could not retrieve the PDF (${response.status}).`);
    file = await response.blob();
  } else {
    const { data, error } = await supabase.storage.from("library-files").download(path.replace(/^\/+/, ""));
    if (error) throw new Error(error.message || "Could not retrieve the PDF.");
    if (!data) throw new Error("The PDF file is empty.");
    file = data;
  }
  if (!file.size) throw new Error("The PDF file is empty.");
  const header = await file.slice(0, 1024).text();
  if (!header.includes("%PDF-")) throw new Error("The stored file is not a valid PDF.");

  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageCount = Number(pdf.numPages) || 0;
  const headings: string[] = [];
  try {
    const pagesToInspect = Math.min(pageCount, 120);
    for (let pageNo = 1; pageNo <= pagesToInspect; pageNo += 1) {
      const page = await pdf.getPage(pageNo);
      const textContent = await page.getTextContent();
      const lines = (textContent.items || []).map((item: any) => String(item.str || "").trim()).filter(Boolean);
      for (const line of lines) {
        const normalized = line.replace(/\s+/g, " ").trim();
        if (normalized.length < 4 || normalized.length > 110) continue;
        const looksLikeHeading = /^(chapter|unit|lesson|module|topic|section)\s+([0-9ivxlcdm]+|[a-z])([. :\s-]|$)/i.test(normalized) ||
          /^\d+(?:\.\d+){0,2}[.)]?\s+[A-Z][^.!?]{3,90}$/.test(normalized);
        const isFragment = /^(section|chapter|unit|lesson|module)\s+\d+(?:\.\d+)*$/i.test(normalized) ||
          /^\d+(?:\.\d+){1,3}[.)]?$/i.test(normalized) ||
          /^(contents|table of contents|learning objectives|review questions|references|bibliography|answer key)$/i.test(normalized);
        if (looksLikeHeading && !isFragment && !headings.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
          headings.push(normalized);
        }
      }
    }
  } finally {
    if (typeof pdf.destroy === "function") await pdf.destroy();
  }
  if (headings.length >= 3) {
    return { units: headings.slice(0, 200), pageCount, method: "headings" };
  }
  if (pageCount > 0) {
    const safeUnits = Math.min(40, Math.max(1, Math.floor(unitsPerBook) || 12));
    const chunkSize = Math.max(1, Math.ceil(pageCount / safeUnits));
    const ranges: string[] = [];
    for (let start = 1; start <= pageCount && ranges.length < 200; start += chunkSize) {
      ranges.push(`Pages ${start}–${Math.min(pageCount, start + chunkSize - 1)}`);
    }
    return { units: ranges, pageCount, method: "page-ranges", message: "No reliable chapter headings were found in the PDF text layer; page ranges are used instead." };
  }
  return { units: [], pageCount: 0, method: "estimated", message: "This PDF has no readable pages." };
}

export async function getPdfPublicUrl(path: string) {
  if (!path) return '';

  // Backward compatibility for legacy rows that may already store
  // an absolute URL instead of a bucket-relative storage path.
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.replace(/^\/+/, '');
  const { data, error } = await supabase.storage.from('library-files').createSignedUrl(normalizedPath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export function isValidPublicUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function getThumbnailPublicUrl(path: string | null) {
  if (!path) return null;

  // Backward compatibility for legacy rows that may already store
  // an absolute URL instead of a bucket-relative storage path.
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.replace(/^\/+/, '');
  const { data, error } = await supabase.storage.from('library-thumbnails').createSignedUrl(normalizedPath, 3600);
  if (error) throw error;
  return data.signedUrl;
}


export interface CurriculumTextbookCatalogEntry {
  id: string;
  grade_level: number;
  curriculum_year_ec: number;
  subject: string;
  book_title: string;
  resource_type: 'student_textbook' | 'teacher_guide' | 'supplementary';
  source_name: string;
  source_url: string;
  source_status: 'verified_official' | 'external_reference' | 'needs_review';
  notes: string;
}

export async function listCurriculumTextbookCatalog(options?: { minGrade?: number; maxGrade?: number }) {
  let query = db
    .from('curriculum_textbook_catalog')
    .select('id, grade_level, curriculum_year_ec, subject, book_title, resource_type, source_name, source_url, source_status, notes')
    .order('grade_level', { ascending: true })
    .order('subject', { ascending: true });
  if (options?.minGrade != null) query = query.gte('grade_level', options.minGrade);
  if (options?.maxGrade != null) query = query.lte('grade_level', options.maxGrade);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as CurriculumTextbookCatalogEntry[];
}
