import { supabase } from '@/integrations/supabase/client';

export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  subject: string;
  description: string;
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

export interface CreateBookPayload {
  title: string;
  author: string;
  subject: string;
  description: string;
  pdfFile: File;
  uploaderId: string;
  uploaderRole: LibraryBook['uploader_role'];
}

const db = supabase as any;

export async function listBooks() {
  const { data, error } = await db
    .from('library_books')
    .select('*, profiles:uploader_id(name, username)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as LibraryBook[];
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
  const ext = payload.pdfFile.name.split('.').pop()?.toLowerCase() || 'pdf';
  const baseName = `${Date.now()}-${crypto.randomUUID()}`;
  const pdfPath = `${payload.uploaderId}/${baseName}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('library-files')
    .upload(pdfPath, payload.pdfFile, { upsert: false, contentType: 'application/pdf' });

  if (uploadError) throw uploadError;

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

  const { data, error } = await db
    .from('library_books')
    .insert({
      title: payload.title,
      author: payload.author,
      subject: payload.subject,
      description: payload.description,
      pdf_path: pdfPath,
      thumbnail_path: thumbnailPath,
      uploader_id: payload.uploaderId,
      uploader_role: payload.uploaderRole,
    })
    .select('*, profiles:uploader_id(name, username)')
    .single();

  if (error) throw error;
  return data as LibraryBook;
}

export async function updateBook(id: string, patch: Partial<Pick<LibraryBook, 'title' | 'author' | 'subject' | 'description'>>) {
  const { data, error } = await db
    .from('library_books')
    .update(patch)
    .eq('id', id)
    .select('*, profiles:uploader_id(name, username)')
    .single();

  if (error) throw error;
  return data as LibraryBook;
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

export function getPdfPublicUrl(path: string) {
  const { data } = supabase.storage.from('library-files').getPublicUrl(path);
  return data.publicUrl;
}

export function getThumbnailPublicUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from('library-thumbnails').getPublicUrl(path);
  return data.publicUrl;
}
