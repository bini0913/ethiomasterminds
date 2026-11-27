import React, { useEffect, useMemo, useRef, useState } from 'react';
import { safeStorage } from '@/lib/safeStorage';
import { motion } from 'framer-motion';
import { useUser } from '@/context/UserContext';
import { getUserTier } from '@/lib/getUserTier';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bookmark, BookmarkCheck, BookOpen, BookMarked, Brain, Download, ExternalLink, FileText, Highlighter, LibraryBig, Loader2, MoreHorizontal, Search, SlidersHorizontal, Sparkles, StickyNote, Upload } from 'lucide-react';
import {
  createBook,
  createHighlight,
  downloadBookPdf,
  deleteBook,
  findCachedAIContent,
  getPdfPublicUrl,
  getThumbnailPublicUrl,
  invokeLibraryAI,
  isValidPublicUrl,
  LibraryBook,
  ReadingProgressEntry,
  CurriculumTextbookCatalogEntry,
  listCurriculumTextbookCatalog,
  saveAIContent,
  listAssignedBooks,
  listBookmarks,
  listBooks,
  listGeneratedQuestions,
  listHighlights,
  listReadingProgress,
  moderateBookUpload,
  saveGeneratedQuestions,
  toggleBookmark,
  updateBook,
  upsertReadingProgress,
} from '@/lib/libraryApi';

const PAGE_SIZE = 9;
const MAX_UPLOAD_SIZE_MB = 50;
const MAX_AI_TEXT_LENGTH = 3500;

type SectionKey = 'my-books' | 'assigned' | 'community' | 'saved' | 'downloaded' | 'curriculum' | 'upload' | 'highlights' | 'notes';

type AiAction = 'summary' | 'simple' | 'questions' | 'flashcards' | 'concepts';

interface GeneratedCard {
  front: string;
  back: string;
}

const LibraryPage: React.FC = () => {
  const { user } = useUser();

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [assignedBooks, setAssignedBooks] = useState<LibraryBook[]>([]);
  const [curriculumBooks, setCurriculumBooks] = useState<CurriculumTextbookCatalogEntry[]>([]);
  const [curriculumCatalogError, setCurriculumCatalogError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'validating' | 'uploading' | 'saving' | 'done'>('idle');
  const [openUpload, setOpenUpload] = useState(false);
  const [bookmarkSet, setBookmarkSet] = useState<Set<string>>(new Set());
  const [downloadedSet, setDownloadedSet] = useState<Set<string>>(new Set());
  const [readingProgress, setReadingProgress] = useState<ReadingProgressEntry[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [activeSection, setActiveSection] = useState<SectionKey>('community');
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [readerUrl, setReaderUrl] = useState<string | null>(null);
  const [readerRetry, setReaderRetry] = useState(0);
  const [readerLoading, setReaderLoading] = useState(false);
  const [readerError, setReaderError] = useState<string | null>(null);
  const [assetUrls, setAssetUrls] = useState<Record<string, { pdf: string; thumbnail: string | null }>>({});
  const [readerProgress, setReaderProgress] = useState(0);
  const [readerPageText, setReaderPageText] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [highlightColor, setHighlightColor] = useState<'yellow' | 'blue' | 'red'>('yellow');
  const [noteText, setNoteText] = useState('');
  const [highlights, setHighlights] = useState<any[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<any[]>([]);
  const [aiOutput, setAiOutput] = useState('');
  const [flashcards, setFlashcards] = useState<GeneratedCard[]>([]);
  const highlightAutoSaveRef = useRef<number | null>(null);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');

  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    author: '',
    subject: '',
    description: '',
    gradeLevel: String(Math.min(12, Math.max(1, Number((user?.grade || '').match(/\d{1,2}/)?.[0] || 9)))),
    type: 'textbook' as LibraryBook['type'],
    bookCategory: 'academic' as LibraryBook['book_category'],
    file: null as File | null,
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const includePending = user.role !== 'student';
      const [bookData, bookmarks, assigned, highlightRows, questionRows] = await Promise.all([
        listBooks({ includePending, userId: user.id }),
        listBookmarks(user.id),
        listAssignedBooks(user.id).catch(() => []),
        listHighlights(user.id).catch(() => []),
        listGeneratedQuestions(user.id).catch(() => []),
      ]);
      setBooks(bookData);
      setBookmarkSet(bookmarks);
      setAssignedBooks(assigned);
      setHighlights(highlightRows);
      setSavedQuestions(questionRows);

      try {
        const catalog = await listCurriculumTextbookCatalog({ minGrade: 9, maxGrade: 12 });
        setCurriculumBooks(catalog);
        setCurriculumCatalogError(false);
      } catch (catalogError) {
        console.warn('Curriculum textbook catalog unavailable:', catalogError);
        setCurriculumBooks([]);
        setCurriculumCatalogError(true);
      }

      const progress = await listReadingProgress(user.id).catch(() => []);
      setReadingProgress(progress);
      if (selectedBook) {
        const row = progress.find((p) => p.book_id === selectedBook.id);
        if (row) setReaderProgress(row.completion_percent);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to load library.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [user?.id]);
  useEffect(() => {
    if (!user?.id) return;
    try {
      const saved = safeStorage.getItem(`masterminds-library-downloads-${user.id}`);
      setDownloadedSet(new Set(saved ? JSON.parse(saved) : []));
    } catch {
      setDownloadedSet(new Set());
    }
  }, [user?.id]);

  const gradeValue = (user?.grade || '').trim();
  const gradeMatch = gradeValue.match(/(?:grade\s*)?(\d{1,2})/i);
  const userGrade = gradeMatch ? Number(gradeMatch[1]) : 0;
  const userTier = getUserTier(user?.grade);
  const studentGradeMin = userTier === 'upper' ? 9 : userTier === 'middle' ? 5 : userTier === 'early' ? 1 : 1;
  const studentGradeMax = userTier === 'upper' ? 12 : userTier === 'middle' ? 8 : userTier === 'early' ? 4 : 12;

  const shortHash = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  };

  const filteredBooks = useMemo(() => {
    const query = search.toLowerCase();

    return books.filter((book) => {
      const inQuery =
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        book.subject.toLowerCase().includes(query) ||
        (book.profiles?.name || '').toLowerCase().includes(query) ||
        book.uploader_role.toLowerCase().includes(query);

      const inSubject = subjectFilter === 'all' || book.subject === subjectFilter;
      const inGrade = gradeFilter === 'all' || String(book.grade_level || '') === gradeFilter;

      if (activeSection === 'my-books') return inQuery && inSubject && inGrade && book.uploader_id === user?.id;
      if (activeSection === 'saved') return inQuery && inSubject && inGrade && bookmarkSet.has(book.id);
      if (activeSection === 'downloaded') return inQuery && inSubject && inGrade && downloadedSet.has(book.id);
      if (activeSection === 'community') {
        if (user?.role === 'student') {
          const grade = Number(book.grade_level || 0);
          if (grade < studentGradeMin || grade > studentGradeMax) return false;
        }
        return inQuery && inSubject && inGrade;
      }
      return inQuery && inSubject && inGrade;
    });
  }, [books, search, subjectFilter, gradeFilter, activeSection, bookmarkSet, downloadedSet, user?.id, user?.role, studentGradeMin, studentGradeMax]);

  const visibleBooks = filteredBooks.slice(0, visibleCount);
  const continueBook = useMemo(() => {
    const candidates = readingProgress
      .filter((entry) => entry.completion_percent > 0 && entry.completion_percent < 100)
      .sort((a, b) => b.completion_percent - a.completion_percent);
    const entry = candidates[0];
    return entry ? { book: books.find((book) => book.id === entry.book_id), progress: entry.completion_percent } : undefined;
  }, [books, readingProgress]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(visibleBooks.map(async (book) => {
        try {
          const [pdf, thumbnail] = await Promise.all([
            getPdfPublicUrl(book.pdf_path),
            getThumbnailPublicUrl(book.thumbnail_path),
          ]);
          return [book.id, { pdf, thumbnail }] as const;
        } catch {
          return [book.id, { pdf: '', thumbnail: null }] as const;
        }
      }));
      if (!cancelled) setAssetUrls((current) => ({ ...current, ...Object.fromEntries(entries) }));
    })();
    return () => { cancelled = true; };
  }, [visibleBooks]);
  const markDownloaded = (bookId: string) => {
    setDownloadedSet((previous) => {
      const next = new Set(previous);
      next.add(bookId);
      if (user?.id) safeStorage.setItem(`masterminds-library-downloads-${user.id}`, JSON.stringify([...next]));
      return next;
    });
  };

  const handleDownload = async (book: LibraryBook) => {
    if (downloadingBookId) return;
    setDownloadingBookId(book.id);
    try {
      await downloadBookPdf(book.pdf_path, book.title);
      markDownloaded(book.id);
      toast.success("PDF download started. Check your device's Downloads folder.");
    } catch (error) {
      console.error("Library PDF download failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not download this book. Please retry.");
    } finally {
      setDownloadingBookId(null);
    }
  };

  const subjects = useMemo(() => Array.from(new Set([...books.map((b) => b.subject), ...curriculumBooks.map((b) => b.subject)])).sort(), [books, curriculumBooks]);
  const sectionCounts: Partial<Record<SectionKey, number>> = {
    'my-books': books.filter((book) => book.uploader_id === user?.id).length,
    assigned: assignedBooks.length,
    community: books.filter((book) => {
      if (user?.role !== 'student') return true;
      const grade = Number(book.grade_level || 0);
      return grade >= studentGradeMin && grade <= studentGradeMax;
    }).length,
    saved: books.filter((book) => bookmarkSet.has(book.id)).length,
    downloaded: books.filter((book) => downloadedSet.has(book.id)).length,
    curriculum: curriculumBooks.length,
    highlights: highlights.length,
    notes: highlights.filter((item) => Boolean(item.note)).length,
  };
  const sectionLabels: Record<SectionKey, string> = {
    'my-books': 'My Books', assigned: 'Assigned Books', community: 'Community Library', saved: 'Saved Resources', downloaded: 'Downloaded', curriculum: 'Curriculum Textbooks', upload: 'Upload Book', highlights: 'Highlights', notes: 'Saved Notes',
  };

  const resetForm = () => {
    const defaultGrade = user?.role === 'student'
      ? Math.min(studentGradeMax, Math.max(studentGradeMin, userGrade || studentGradeMin))
      : 9;
    setForm({ title: '', author: '', subject: '', description: '', gradeLevel: String(defaultGrade), type: 'textbook', bookCategory: 'academic', file: null });
    setEditingBookId(null);
  };

  const canViewCurriculum = userTier === 'upper' || user?.role !== 'student';

  const canUpload = !!user && (
    user.role === 'teacher' ||
    user.role === 'admin' ||
    user.role === 'manager' ||
    (user.role === 'student' && userGrade >= studentGradeMin && userGrade <= studentGradeMax)
  );

  const handleUploadOrEdit = async () => {
    if (!user) return;

    if (!form.title.trim() || !form.author.trim() || !form.subject.trim() || !form.description.trim()) {
      toast.error('Please fill all metadata fields.');
      return;
    }

    if (user.role === 'student') {
      const g = Number(form.gradeLevel);
      if (g < studentGradeMin || g > studentGradeMax) {
        toast.error(`Students can upload/share for Grade ${studentGradeMin} to Grade ${studentGradeMax} only.`);
        return;
      }
    }

    setUploading(true);
    setUploadPhase('validating');

    try {
      if (editingBookId) {
        await updateBook(editingBookId, {
          title: form.title,
          author: form.author,
          subject: form.subject,
          description: form.description,
          grade_level: Number(form.gradeLevel),
          type: form.type,
          book_category: form.bookCategory,
        });
        toast.success('Book details updated.');
      } else {
        if (!form.file) {
          toast.error('Please choose a PDF file.');
          return;
        }

        if (form.file.type !== 'application/pdf') {
          toast.error('Only PDF files are allowed.');
          return;
        }
        if (form.file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
          toast.error(`File too large. Max size is ${MAX_UPLOAD_SIZE_MB}MB.`);
          return;
        }

        const created = await createBook({
          title: form.title,
          author: form.author,
          subject: form.subject,
          description: form.description,
          gradeLevel: Number(form.gradeLevel),
          type: form.type,
          bookCategory: form.bookCategory,
          pdfFile: form.file,
          uploaderId: user.id,
          uploaderRole: user.role as 'admin' | 'manager' | 'student' | 'teacher',
          onProgress: setUploadPhase,
        });
        toast.success(created.status === 'approved' ? 'Book uploaded to library.' : 'Book uploaded and waiting for approval.');
      }

      await load();
      setOpenUpload(false);
      resetForm();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Upload failed, try again.';
      toast.error(message);
    } finally {
      setUploading(false);
      setUploadPhase('idle');
    }
  };

  const handleDelete = async (bookId: string) => {
    try {
      await deleteBook(bookId);
      toast.success('Book deleted.');
      await load();
    } catch {
      toast.error('Failed to delete book.');
    }
  };

  const canManageBook = (book: LibraryBook) => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'manager' || user.role === 'teacher') return true;
    return book.uploader_id === user.id;
  };

  const openReader = async (book: LibraryBook) => {
    let url = "";
    try {
      // Always request a fresh signed URL; cached URLs expire and can otherwise
      // make a book that was previously readable fail after a long session.
      url = await getPdfPublicUrl(book.pdf_path);
    } catch {
      toast.error('Book file could not be opened. Please retry.');
      return;
    }
    if (!isValidPublicUrl(url)) {
      toast.error('Book file URL is invalid. Please retry.');
      return;
    }

    const cached = safeStorage.getItem(`library:last-book:${user?.id}`);
    if (cached !== book.id) {
      safeStorage.setItem(`library:last-book:${user?.id}`, book.id);
    }

    setSelectedBook(book);
    setReaderUrl(url);
    setReaderLoading(true);
    setReaderError(null);
    setReaderOpen(true);
    setReaderPageText('');
    setSelectedText('');
    setAiOutput('');
    setFlashcards([]);
  };

  const runAi = async (action: AiAction) => {
    if (!selectedBook || !user) return;
    if (aiBusy) return;
    const baseText = (selectedText || readerPageText || '').trim();
    const limitedText = baseText.slice(0, MAX_AI_TEXT_LENGTH);
    if (!limitedText) {
      toast.error('Select text or add page text first.');
      return;
    }
    // Version the cache namespace so previously stored client-generated fallback text
    // is not mistaken for a response produced by the real library AI service.
    setAiBusy(true);
    const cacheKey = shortHash(`server-ai-v2:${action}:${selectedBook.id}:${limitedText}`);

    let output = '';
    const cached = await findCachedAIContent({
      user_id: user.id,
      book_id: selectedBook.id,
      action,
      source_hash: cacheKey,
    }).catch(() => null);

    if (cached?.response) {
      output = cached.response;
    } else {
      try {
        output = await invokeLibraryAI({
          action,
          text: limitedText,
          grade: Number(user.grade || 9),
          subject: selectedBook.subject,
        });
        if (!output.trim()) throw new Error("The AI service returned an empty response. Please try again.");
      } catch (error) {
        console.error("Library AI request failed:", error);
        toast.error(error instanceof Error ? error.message : "Library AI is temporarily unavailable. Please try again.");
        setAiBusy(false);
        return;
      }

      // Only responses returned by the real AI service are persisted in the AI cache.
      await saveAIContent({
        user_id: user.id,
        book_id: selectedBook.id,
        action,
        source_hash: cacheKey,
        source_excerpt: limitedText.slice(0, 350),
        response: output,
      }).catch((error) => {
        console.warn("Library AI response could not be cached:", error);
      });
    }

    setAiOutput(output);

    if (action === 'questions') {
      const questions = output.split('\n\n').map((chunk, idx) => {
        const lines = chunk.split('\n');
        return {
          user_id: user.id,
          book_id: selectedBook.id,
          page_number: Math.max(1, Math.round((readerProgress / 100) * 100)),
          question: lines[0]?.replace(/^Q\d+:\s*/, '') || `Question ${idx + 1}`,
          answer: lines[1]?.replace(/^A\d+:\s*/, '') || 'See excerpt',
          difficulty: (idx % 3 === 0 ? 'easy' : idx % 3 === 1 ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard',
          source_excerpt: limitedText.slice(0, 250),
        };
      });

      await saveGeneratedQuestions(questions).catch(() => undefined);
      setSavedQuestions((prev) => [...questions, ...prev]);
    }

    if (action === 'flashcards') {
      const cards = output.split('\n').filter(Boolean).map((line, idx) => ({
        front: `Concept ${idx + 1}`,
        back: line.replace(/^Card\s\d+:\s*/, ''),
      }));
      setFlashcards(cards);
    }

    setAiBusy(false);
  };

  const saveHighlight = async () => {
    if (!selectedBook || !user) return;
    if (!selectedText.trim()) {
      toast.error('Select or paste text first.');
      return;
    }

    try {
      const saved = await createHighlight({
        user_id: user.id,
        book_id: selectedBook.id,
        page_number: Math.max(1, Math.round((readerProgress / 100) * 100)),
        selected_text: selectedText,
        highlight_color: highlightColor,
        note: noteText.trim() || null,
      });
      setHighlights((prev) => [saved, ...prev]);
      setNoteText('');
      toast.success('Highlight saved.');
    } catch {
      toast.error('Failed to save highlight.');
    }
  };

  useEffect(() => {
    if (!readerOpen || !selectedBook || !user) return;
    const trimmed = selectedText.trim();
    if (trimmed.length < 20) return;

    if (highlightAutoSaveRef.current) {
      window.clearTimeout(highlightAutoSaveRef.current);
    }

    highlightAutoSaveRef.current = window.setTimeout(async () => {
      const alreadySaved = highlights.some(
        (item) => item.book_id === selectedBook.id && item.selected_text === trimmed,
      );
      if (alreadySaved) return;

      await createHighlight({
        user_id: user.id,
        book_id: selectedBook.id,
        page_number: Math.max(1, Math.round((readerProgress / 100) * 100)),
        selected_text: trimmed,
        highlight_color: highlightColor,
        note: noteText.trim() || null,
      })
        .then((saved) => {
          setHighlights((prev) => [saved, ...prev]);
          toast.success('Highlight autosaved.');
        })
        .catch(() => undefined);
    }, 900);

    return () => {
      if (highlightAutoSaveRef.current) {
        window.clearTimeout(highlightAutoSaveRef.current);
      }
    };
  }, [selectedText, selectedBook?.id, user?.id, readerOpen, highlights, readerProgress, highlightColor, noteText, selectedBook, user]);

  const markReaderProgress = async (next: number) => {
    setReaderProgress(next);
    if (!selectedBook || !user) return;
    await upsertReadingProgress({
      user_id: user.id,
      book_id: selectedBook.id,
      last_page: Math.max(1, Math.round((next / 100) * 100)),
      completion_percent: next,
      time_spent_seconds: Math.max(60, Math.round((next / 100) * 1800)),
    }).catch(() => undefined);
  };

  useEffect(() => {
    if (!readerUrl) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'document';
    link.href = readerUrl;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, [readerUrl, readerRetry]);

  if (!user) return null;

  return (
    <div className={`${userTier === 'upper' ? 'tier-upper' : 'tier-middle'} min-h-screen bg-background text-foreground`}>
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">
        <header className="mb-6 flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Master Minds Library</p>
              <h1 className="truncate text-3xl font-bold tracking-tight sm:text-4xl">Find your next useful resource.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A calm place to discover, read, save, and turn books into better study sessions.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground sm:flex">
              <BookOpen className="h-4 w-4 text-primary" />
              <span><strong className="text-foreground">{books.length}</strong> resources</span>
              <span className="text-border">•</span>
              <span><strong className="text-foreground">{highlights.length}</strong> highlights</span>
            </div>
            {canUpload && (
              <Dialog open={openUpload} onOpenChange={setOpenUpload}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm} className="gap-2"><Upload className="h-4 w-4" /> Add a book</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingBookId ? 'Edit book details' : 'Add a book to the library'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div><Label htmlFor="library-title">Book title</Label><Input id="library-title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} /></div>
                    <div><Label htmlFor="library-author">Author</Label><Input id="library-author" value={form.author} onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label htmlFor="library-subject">Subject</Label><Input id="library-subject" value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} /></div>
                      <div><Label htmlFor="library-grade">Grade</Label><Input id="library-grade" type="number" min={user?.role === 'student' ? studentGradeMin : 1} max={user?.role === 'student' ? studentGradeMax : 12} value={form.gradeLevel} onChange={(e) => setForm((p) => ({ ...p, gradeLevel: e.target.value }))} /></div>
                    </div>
                    <div><Label>Reading experience</Label><Select value={form.bookCategory} onValueChange={(value: LibraryBook['book_category']) => setForm((p) => ({ ...p, bookCategory: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="academic">Academic study</SelectItem><SelectItem value="general">General reading</SelectItem></SelectContent></Select></div>
                    <div><Label>Content type</Label><Select value={form.type} onValueChange={(value: LibraryBook['type']) => setForm((p) => ({ ...p, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="textbook">Textbook</SelectItem><SelectItem value="notes">Notes</SelectItem><SelectItem value="practice">Practice book</SelectItem><SelectItem value="reference">Reference</SelectItem></SelectContent></Select></div>
                    <div><Label htmlFor="library-description">Short description</Label><Textarea id="library-description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
                    {!editingBookId && <div><Label htmlFor="library-file">PDF file</Label><Input id="library-file" type="file" accept="application/pdf" onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] || null }))} /></div>}
                    <Button className="w-full" onClick={handleUploadOrEdit} disabled={uploading}>{uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingBookId ? 'Save changes' : 'Add to library'}</Button>
                    {uploading && <div className="space-y-2"><Progress value={uploadPhase === 'validating' ? 20 : uploadPhase === 'uploading' ? 55 : uploadPhase === 'saving' ? 85 : 100} /><p className="text-xs text-muted-foreground">{uploadPhase === 'uploading' ? 'Uploading PDF…' : uploadPhase === 'saving' ? 'Saving book details…' : 'Checking your upload…'}</p></div>}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </header>

        <nav className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Library sections">
          {([
            ['community', 'Discover', Search], ['my-books', 'My books', LibraryBig], ['assigned', 'Assigned', BookMarked], ['saved', 'Saved', Bookmark], ['downloaded', 'Downloaded', Download], ...(canViewCurriculum ? [['curriculum', 'Curriculum', FileText] as const] : []), ['highlights', 'Highlights', Highlighter], ['notes', 'Notes', StickyNote],
          ] as const).map(([key, label, Icon]) => (
            <Button key={key} variant={activeSection === key ? 'default' : 'outline'} aria-current={activeSection === key ? 'page' : undefined} className="shrink-0 gap-2 rounded-full" onClick={() => { setActiveSection(key); setVisibleCount(PAGE_SIZE); }}><Icon className="h-4 w-4" />{label}{sectionCounts[key] !== undefined && <span className="ml-1 opacity-70">{sectionCounts[key]}</span>}</Button>
          ))}
          {canUpload && <Button variant="outline" className="shrink-0 gap-2 rounded-full" onClick={() => { resetForm(); setOpenUpload(true); }}><Upload className="h-4 w-4" />Add a book</Button>}
        </nav>

        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-20 rounded-2xl border border-border bg-card p-3 shadow-sm">
              <p className="px-3 pb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Your library</p>
              <nav className="space-y-1" aria-label="Library sections">
                {([
                  ['community', 'Discover', Search], ['my-books', 'My books', LibraryBig], ['assigned', 'Assigned', BookMarked], ['saved', 'Saved resources', Bookmark], ['downloaded', 'Downloaded', Download], ...(canViewCurriculum ? [['curriculum', 'Curriculum', FileText] as const] : []), ['highlights', 'Highlights', Highlighter], ['notes', 'Saved notes', StickyNote],
                ] as const).map(([key, label, Icon]) => (
                  <button key={key} type="button" aria-current={activeSection === key ? 'page' : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition ${activeSection === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} onClick={() => { setActiveSection(key); setVisibleCount(PAGE_SIZE); }}>
                    <Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{label}</span>{sectionCounts[key] !== undefined && <span className={`rounded-full px-2 py-0.5 text-xs ${activeSection === key ? 'bg-primary-foreground/15' : 'bg-muted'}`}>{sectionCounts[key]}</span>}
                  </button>
                ))}
              </nav>
              <div className="mt-4 border-t border-border pt-4"><p className="px-3 text-xs leading-5 text-muted-foreground">Read first. Save what matters. Come back when you are ready.</p></div>
            </div>
          </aside>

          <main className="min-w-0 space-y-5">
            {(activeSection === 'community' || activeSection === 'my-books' || activeSection === 'saved' || activeSection === 'downloaded') && <>
              <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{activeSection === 'community' ? 'Discover' : sectionLabels[activeSection]}</p><h2 className="mt-1 text-2xl font-bold">{activeSection === 'community' ? 'Explore your learning shelf' : sectionLabels[activeSection]}</h2><p className="mt-1 text-sm text-muted-foreground">{filteredBooks.length} resource{filteredBooks.length === 1 ? '' : 's'} in this view.</p></div>
                  {activeSection === 'community' && <Badge variant="outline" className="w-fit rounded-full">Grades {studentGradeMin}–{studentGradeMax}</Badge>}
                </div>
                {activeSection === 'community' && continueBook?.book && <button type="button" className="mb-4 flex w-full flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left transition hover:border-primary/40 hover:bg-primary/10 sm:flex-row sm:items-center sm:justify-between" onClick={() => openReader(continueBook.book!)}>
                  <span className="min-w-0"><span className="block text-xs font-semibold uppercase tracking-[0.16em] text-primary">Continue reading</span><span className="mt-1 block truncate font-semibold">{continueBook.book.title}</span><span className="mt-1 block text-sm text-muted-foreground">You are {Math.round(continueBook.progress)}% through this resource.</span></span><span className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-primary">Open book <BookOpen className="h-4 w-4" /></span>
                </button>}
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_150px]">
                  <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search library" className="h-11 pl-9" placeholder="Search books, subjects, or authors" value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }} /></div>
                  <Select value={subjectFilter} onValueChange={(value) => { setSubjectFilter(value); setVisibleCount(PAGE_SIZE); }}><SelectTrigger className="h-11"><SlidersHorizontal className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="All subjects" /></SelectTrigger><SelectContent><SelectItem value="all">All subjects</SelectItem>{subjects.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}</SelectContent></Select>
                  <Select value={gradeFilter} onValueChange={(value) => { setGradeFilter(value); setVisibleCount(PAGE_SIZE); }}><SelectTrigger className="h-11"><SelectValue placeholder="All grades" /></SelectTrigger><SelectContent><SelectItem value="all">All grades</SelectItem>{Array.from({ length: user?.role === 'student' ? studentGradeMax - studentGradeMin + 1 : 12 }, (_, index) => { const grade = user?.role === 'student' ? studentGradeMin + index : index + 1; return <SelectItem key={grade} value={String(grade)}>Grade {grade}</SelectItem>; })}</SelectContent></Select>
                </div>
              </section>

              {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-[360px] animate-pulse rounded-2xl border border-border bg-muted/50" />)}</div> : filteredBooks.length === 0 ? <Card className="border-dashed"><CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center"><div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary"><BookOpen className="h-8 w-8" /></div><h3 className="text-lg font-semibold">{activeSection === 'saved' ? 'Your shelf is ready for its first save' : activeSection === 'downloaded' ? 'Nothing downloaded yet' : 'No resources match these filters'}</h3><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{activeSection === 'saved' ? 'Use the bookmark action on a resource you want to revisit.' : activeSection === 'downloaded' ? 'Download a PDF from Discover and it will appear here.' : 'Try a different subject, grade, or search phrase.'}</p></CardContent></Card> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleBooks.map((book) => {
                const thumbnailUrl = assetUrls[book.id]?.thumbnail || null;
                const pdfUrl = assetUrls[book.id]?.pdf || '';
                const hasValidPdfUrl = isValidPublicUrl(pdfUrl);
                const isBookmarked = bookmarkSet.has(book.id);
                return <motion.article key={book.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }} transition={{ duration: 0.2 }} className="glass group flex h-full flex-col overflow-hidden rounded-2xl transition-shadow hover:shadow-md">
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">{thumbnailUrl ? <img src={thumbnailUrl} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" alt="" /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground"><FileText className="h-8 w-8" /><span className="text-xs">PDF resource</span></div>}<div className="absolute left-3 top-3 flex gap-2"><Badge className="rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur">{book.subject}</Badge>{book.status !== 'approved' && <Badge variant="destructive" className="rounded-full">{book.status}</Badge>}</div><button type="button" aria-label={isBookmarked ? `Remove ${book.title} from saved resources` : `Save ${book.title}`} className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={async () => { try { const next = await toggleBookmark(book.id, user.id, isBookmarked); setBookmarkSet((prev) => { const set = new Set(prev); if (next) set.add(book.id); else set.delete(book.id); return set; }); toast.success(next ? 'Saved to your shelf.' : 'Removed from your shelf.'); } catch { toast.error('Could not update your shelf.'); } }}>{isBookmarked ? <BookmarkCheck className="h-4 w-4 fill-current" /> : <Bookmark className="h-4 w-4" />}</button></div>
                  <div className="flex flex-1 flex-col p-4"><div className="mb-3 flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="line-clamp-2 text-lg font-semibold leading-tight">{book.title}</h3><p className="mt-1 text-sm text-muted-foreground">{book.author}</p></div><Badge variant="outline" className="shrink-0 rounded-full">Grade {book.grade_level || '—'}</Badge></div><p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{book.description}</p><div className="mt-auto flex items-center justify-between gap-3 pt-5"><Button className="gap-2" onClick={() => openReader(book)} disabled={!hasValidPdfUrl}><BookOpen className="h-4 w-4" />Read</Button><div className="flex items-center gap-1"><Button size="icon" variant="ghost" disabled={!hasValidPdfUrl || downloadingBookId === book.id} aria-label={`Download ${book.title}`} title="Download PDF" onClick={() => void handleDownload(book)}>{downloadingBookId === book.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`More actions for ${book.title}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { navigator.clipboard?.writeText(book.title); toast.success('Book title copied.'); }}>Copy title</DropdownMenuItem>{canManageBook(book) && <><DropdownMenuSeparator /><DropdownMenuItem onClick={() => { setEditingBookId(book.id); setForm({ title: book.title, author: book.author, subject: book.subject, description: book.description, gradeLevel: String(book.grade_level || 9), type: book.type, bookCategory: book.book_category || 'academic', file: null }); setOpenUpload(true); }}>Edit details</DropdownMenuItem>{book.status !== 'approved' && (user.role === 'teacher' || user.role === 'admin' || user.role === 'manager') && <><DropdownMenuItem onClick={async () => { await moderateBookUpload({ bookId: book.id, moderatorId: user.id, status: 'approved', note: 'Approved by moderator' }); toast.success('Book approved.'); await load(); }}>Approve</DropdownMenuItem><DropdownMenuItem onClick={async () => { await moderateBookUpload({ bookId: book.id, moderatorId: user.id, status: 'rejected', note: 'Rejected by moderator' }); toast.success('Book rejected.'); await load(); }}>Reject</DropdownMenuItem></>}<DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { if (window.confirm(`Delete “${book.title}”?`)) void handleDelete(book.id); }}>Delete</DropdownMenuItem></>}</DropdownMenuContent></DropdownMenu></div></div></div>
                </motion.article>;
              })}</div>}
              {!loading && visibleCount < filteredBooks.length && <div className="flex justify-center"><Button variant="outline" onClick={() => setVisibleCount((value) => value + PAGE_SIZE)}>Load more resources</Button></div>}
            </>}

            {activeSection === 'assigned' && <section className="glass rounded-2xl p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">For you</p><h2 className="mt-1 text-2xl font-bold">Assigned reading</h2><p className="mt-1 text-sm text-muted-foreground">Resources shared with you by a teacher or school.</p><div className="mt-6 space-y-3">{assignedBooks.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center"><BookMarked className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nothing assigned yet</p><p className="mt-1 text-sm text-muted-foreground">Assigned books will appear here when they are ready.</p></div> : assignedBooks.map((book) => <div key={book.id} className="glass flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">{book.title}</h3><p className="mt-1 text-sm text-muted-foreground">{book.subject} · Grade {book.grade_level || '—'} · {book.author}</p></div><div className="flex flex-wrap gap-2 sm:shrink-0"><Button className="gap-2" onClick={() => openReader(book)}><BookOpen className="h-4 w-4" />Read assignment</Button><Button variant="outline" className="gap-2" disabled={downloadingBookId === book.id} onClick={() => void handleDownload(book)}>{downloadingBookId === book.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download</Button></div></div>)}</div></section>}

            {activeSection === 'curriculum' && canViewCurriculum && <section className="glass rounded-2xl p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Reference shelf</p><h2 className="mt-1 text-2xl font-bold">Curriculum textbooks</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">A curated index of Grade 9–12 curriculum references. External links open in a new tab so you can keep your library context.</p>{curriculumCatalogError && <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">The curriculum catalog could not be loaded. Existing library resources are still available.</div>}<div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{curriculumBooks.filter((book) => { const query = search.trim().toLowerCase(); return (!query || book.book_title.toLowerCase().includes(query) || book.subject.toLowerCase().includes(query)) && (gradeFilter === 'all' || String(book.grade_level) === gradeFilter) && (subjectFilter === 'all' || book.subject === subjectFilter); }).map((book) => <article key={book.id} className="glass flex flex-col rounded-xl p-4"><div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><FileText className="h-5 w-5" /></div><div><h3 className="font-semibold leading-tight">{book.book_title}</h3><p className="mt-1 text-sm text-muted-foreground">{book.subject} · Grade {book.grade_level}</p></div></div><p className="mt-4 flex-1 text-sm leading-6 text-muted-foreground">{book.notes}</p><Button asChild variant="outline" className="mt-4 w-full gap-2"><a href={book.source_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Open textbook index</a></Button></article>)}</div></section>}

            {(activeSection === 'highlights' || activeSection === 'notes') && <section className="glass rounded-2xl p-5"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your study memory</p><h2 className="mt-1 text-2xl font-bold">{activeSection === 'highlights' ? 'Highlights' : 'Saved notes'}</h2><p className="mt-1 text-sm text-muted-foreground">Small pieces of reading you chose to keep close.</p><div className="mt-6 space-y-3">{highlights.filter((item) => activeSection === 'highlights' || Boolean(item.note)).length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center"><Highlighter className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">Nothing saved here yet</p><p className="mt-1 text-sm text-muted-foreground">Open a book, select an excerpt, and save it while you read.</p></div> : highlights.filter((item) => activeSection === 'highlights' || Boolean(item.note)).map((item) => <article key={item.id} className="glass rounded-xl p-4"><div className="flex items-center justify-between gap-3"><Badge variant="secondary" className="capitalize rounded-full">{item.highlight_color} highlight</Badge><span className="text-xs text-muted-foreground">Page {item.page_number}</span></div><p className="mt-3 text-sm leading-6">“{item.selected_text}”</p>{item.note && <p className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-6 text-muted-foreground">{item.note}</p>}</article>)}</div></section>}
          </main>
        </div>
      </div>

      <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
        <DialogContent className="glass-panel fixed inset-0 left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 rounded-none p-0">
          <div className={`grid h-full min-h-0 grid-cols-1 ${selectedBook?.book_category === 'academic' && aiPanelOpen ? 'grid-rows-[minmax(0,1fr)_minmax(0,35dvh)] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
            <section className="flex min-h-0 flex-col bg-[#eef1f4]">
              <div className="flex flex-wrap items-center justify-between gap-3 glass-nav-top border-b border-border px-4 py-3 sm:px-6"><div className="min-w-0"><p className="truncate font-semibold">{selectedBook?.title || 'Reader'}</p><p className="text-xs text-muted-foreground">{selectedBook?.author} · {Math.round(readerProgress)}% complete</p></div><div className="flex items-center gap-2">{selectedBook?.book_category === 'academic' && <Button size="sm" variant="outline" className="gap-2" onClick={() => setAiPanelOpen((open) => !open)}><Brain className="h-4 w-4" />{aiPanelOpen ? 'Hide tools' : 'Study tools'}</Button>}<Button size="sm" variant="outline" onClick={() => markReaderProgress(Math.min(100, readerProgress + 10))}>Mark +10%</Button></div></div>
              <div className="min-h-0 flex-1 p-2 sm:p-4"><div className="relative h-full">{readerLoading && <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border bg-background/90"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Opening your book…</p></div></div>}{readerError ? <div className="flex h-full items-center justify-center rounded-xl border bg-background"><div className="text-center"><p className="text-sm text-destructive">{readerError}</p><Button className="mt-3" size="sm" onClick={() => { setReaderRetry((value) => value + 1); setReaderLoading(true); setReaderError(null); }}>Try again</Button></div></div> : readerUrl && selectedBook && <iframe key={`${selectedBook.id}-${readerRetry}`} title={`Reading ${selectedBook.title}`} src={readerUrl} className="h-full w-full rounded-xl bg-white" onLoad={() => setReaderLoading(false)} onError={() => { setReaderLoading(false); setReaderError('The reader could not load this PDF.'); }} />}</div></div>
              {selectedBook?.book_category === 'academic' && <div className="grid gap-2 glass-panel border-t border-border p-3 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="reader-selection" className="sr-only">Selected text</Label><Input id="reader-selection" placeholder="Paste selected text to highlight or study" value={selectedText} onChange={(e) => setSelectedText(e.target.value)} /></div><div className="flex flex-wrap gap-2"><Button size="sm" variant={highlightColor === 'yellow' ? 'default' : 'outline'} onClick={() => setHighlightColor('yellow')}><Highlighter className="mr-1 h-4 w-4" />Yellow</Button><Button size="sm" variant={highlightColor === 'blue' ? 'default' : 'outline'} onClick={() => setHighlightColor('blue')}>Blue</Button><Button size="sm" variant={highlightColor === 'red' ? 'default' : 'outline'} onClick={() => setHighlightColor('red')}>Red</Button></div><div className="flex gap-2"><Label htmlFor="reader-note" className="sr-only">Note</Label><Input id="reader-note" placeholder="Add a note" value={noteText} onChange={(e) => setNoteText(e.target.value)} /><Button size="sm" onClick={saveHighlight}>Save</Button></div></div>}
            </section>
            {selectedBook?.book_category === 'academic' && aiPanelOpen && <aside className="min-h-0 overflow-y-auto border-l border-border bg-background p-4 sm:p-5"><div className="mb-4"><p className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />Study tools</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Use a short excerpt when you want help. The reader stays the source of truth.</p></div><div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" disabled={aiBusy} onClick={() => runAi('summary')}>{aiBusy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Summarize</Button><Button size="sm" variant="outline" disabled={aiBusy} onClick={() => runAi('simple')}>Explain simply</Button><Button size="sm" variant="outline" disabled={aiBusy} onClick={() => runAi('questions')}>Practice questions</Button><Button size="sm" variant="outline" disabled={aiBusy} onClick={() => runAi('flashcards')}>Flashcards</Button><Button size="sm" variant="outline" disabled={aiBusy} className="col-span-2" onClick={() => runAi('concepts')}>Key concepts</Button></div><Card className="mt-4"><CardHeader><CardTitle className="text-sm">AI response</CardTitle></CardHeader><CardContent><pre className="whitespace-pre-wrap font-sans text-xs leading-5">{aiOutput || 'Choose a study tool after adding page text or a selection.'}</pre></CardContent></Card>{flashcards.length > 0 && <Card className="mt-3"><CardHeader><CardTitle className="text-sm">Generated flashcards</CardTitle></CardHeader><CardContent className="space-y-2">{flashcards.map((card, index) => <div key={index} className="rounded-lg border p-3"><p className="text-xs font-semibold">{card.front}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{card.back}</p></div>)}</CardContent></Card>}<Card className="mt-3"><CardHeader><CardTitle className="text-sm">Saved practice questions</CardTitle></CardHeader><CardContent className="space-y-2">{savedQuestions.filter((question) => question.book_id === selectedBook.id).length === 0 ? <p className="text-xs text-muted-foreground">Questions you save from this reader will appear here.</p> : savedQuestions.filter((question) => question.book_id === selectedBook.id).slice(0, 10).map((question) => <div key={question.id || question.question} className="rounded-lg border p-3"><p className="text-xs font-semibold">Q: {question.question}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A: {question.answer}</p></div>)}</CardContent></Card></aside>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LibraryPage;
