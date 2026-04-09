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
  pdfFile: File;
  uploaderId: string;
  uploaderRole: LibraryBook['uploader_role'];
  onProgress?: (state: 'validating' | 'uploading' | 'saving' | 'done') => void;
}

const db = supabase as any;

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: string }).code) : undefined;
}

export async function listBooks(options?: { includePending?: boolean; userId?: string }) {
  const includePending = options?.includePending ?? false;
  const userId = options?.userId;

  let query = db
    .from('library_books')
    .select('*, profiles:uploader_id(name, username)')
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
  return (data || []) as LibraryBook[];
}

export async function listAssignedBooks(userId: string) {
  const { data, error } = await db
    .from('book_permissions')
    .select('book_id, library_books!inner(*, profiles:uploader_id(name, username))')
    .eq('user_id', userId)
    .eq('can_read', true)
    .eq('library_books.status', 'approved');

  if (error) throw error;
  return (data || []).map((row: any) => row.library_books) as LibraryBook[];
}

async function generatePdfThumbnail(pdfFile: File): Promise<Blob | null> {
  try {
    const pdfjs = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.min.mjs');
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

  if (payload.pdfFile.type !== 'application/pdf') {
    throw new Error('Only PDF files are supported.');
  }

  const maxPdfSizeBytes = 50 * 1024 * 1024;
  if (payload.pdfFile.size > maxPdfSizeBytes) {
    throw new Error('File too large. Please upload a PDF smaller than 50MB.');
  }

  const ext = payload.pdfFile.name.split('.').pop()?.toLowerCase() || 'pdf';
  const baseName = `${Date.now()}-${crypto.randomUUID()}`;
  const pdfPath = `${payload.uploaderId}/${baseName}.${ext}`;

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

  const status: UploadStatus = payload.uploaderRole === 'teacher' || payload.uploaderRole === 'admin' || payload.uploaderRole === 'manager'
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
      status,
      pdf_path: pdfPath,
      thumbnail_path: thumbnailPath,
      uploader_id: payload.uploaderId,
      uploader_role: payload.uploaderRole,
    })
    .select('*, profiles:uploader_id(name, username)')
    .single();

  if (error) throw error;

  const createdBook = data as LibraryBook;

  try {
    const { error: insertUploadError } = await db.from('book_uploads').insert({
      book_id: createdBook.id,
      uploader_id: payload.uploaderId,
      status,
      moderated_at: status === 'approved' ? new Date().toISOString() : null,
      moderation_note: status === 'approved' ? 'Auto-approved by role policy' : 'Awaiting teacher/admin moderation',
    });

    if (insertUploadError) {
      const code = getErrorCode(insertUploadError);

      if (code === '23505') {
        const { error: updateUploadError } = await db
          .from('book_uploads')
          .update({
            status,
            moderated_at: status === 'approved' ? new Date().toISOString() : null,
            moderation_note: status === 'approved' ? 'Auto-approved by role policy' : 'Awaiting teacher/admin moderation',
          })
          .eq('book_id', createdBook.id);
        if (updateUploadError) throw updateUploadError;
      } else {
        // Do not block successful book upload if audit table isn't ready yet.
        console.warn('book_uploads sync skipped:', insertUploadError);
      }
    }
  } catch (uploadAuditError) {
    console.warn('book_uploads sync failed:', uploadAuditError);
  }

  payload.onProgress?.('done');
  return createdBook;
}

export async function updateBook(id: string, patch: Partial<Pick<LibraryBook, 'title' | 'author' | 'subject' | 'description' | 'grade_level' | 'type' | 'status'>>) {
  const { data, error } = await db
    .from('library_books')
    .update(patch)
    .eq('id', id)
    .select('*, profiles:uploader_id(name, username)')
    .single();

  if (error) throw error;
  return data as LibraryBook;
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

export function getPdfPublicUrl(path: string) {
  const { data } = supabase.storage.from('library-files').getPublicUrl(path);
  return data.publicUrl;
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

export function getThumbnailPublicUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from('library-thumbnails').getPublicUrl(path);
  return data.publicUrl;
}
