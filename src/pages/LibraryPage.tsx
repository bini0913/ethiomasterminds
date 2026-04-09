import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/context/UserContext';
import { toast } from 'sonner';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bookmark, BookmarkCheck, BookOpen, Brain, Download, Highlighter, Loader2, Search, Upload, User } from 'lucide-react';
import {
  createBook,
  createHighlight,
  deleteBook,
  getPdfPublicUrl,
  getThumbnailPublicUrl,
  LibraryBook,
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

type SectionKey = 'my-books' | 'assigned' | 'community' | 'upload' | 'highlights' | 'notes';

type AiAction = 'summary' | 'simple' | 'questions' | 'flashcards' | 'concepts';

interface GeneratedCard {
  front: string;
  back: string;
}

function generateAiContent(action: AiAction, text: string, grade: number) {
  const normalized = text.trim();
  if (!normalized) {
    return 'Please add page text or selected text first so AI can help.';
  }

  const sentences = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
  const easyTone = grade <= 4;

  if (action === 'summary') {
    return sentences.slice(0, 3).join(' ') || normalized.slice(0, 220);
  }

  if (action === 'simple') {
    return easyTone
      ? `Simple explanation: ${sentences[0] || normalized.slice(0, 120)}. Think of it like learning one step at a time.`
      : `Detailed explanation: ${sentences.slice(0, 2).join(' ')} This topic connects to deeper subject understanding and exam application.`;
  }

  if (action === 'concepts') {
    const words = Array.from(new Set(normalized.toLowerCase().match(/[a-z]{5,}/g) || []));
    return words.slice(0, 8).map((w, idx) => `${idx + 1}. ${w}`).join('\n') || 'No key concepts extracted yet.';
  }

  if (action === 'questions') {
    return Array.from({ length: 5 }).map((_, i) => `Q${i + 1}: What is a key idea from this section?\nA${i + 1}: ${sentences[i % Math.max(1, sentences.length)] || normalized.slice(0, 100)}`).join('\n\n');
  }

  return Array.from({ length: 5 }).map((_, i) => `Card ${i + 1}: ${sentences[i % Math.max(1, sentences.length)] || normalized.slice(0, 90)}`).join('\n');
}

const LibraryPage: React.FC = () => {
  const { user } = useUser();

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [assignedBooks, setAssignedBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [bookmarkSet, setBookmarkSet] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [activeSection, setActiveSection] = useState<SectionKey>('community');
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerProgress, setReaderProgress] = useState(0);
  const [readerPageText, setReaderPageText] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [highlightColor, setHighlightColor] = useState<'yellow' | 'blue' | 'red'>('yellow');
  const [noteText, setNoteText] = useState('');
  const [highlights, setHighlights] = useState<any[]>([]);
  const [savedQuestions, setSavedQuestions] = useState<any[]>([]);
  const [aiOutput, setAiOutput] = useState('');
  const [flashcards, setFlashcards] = useState<GeneratedCard[]>([]);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');

  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    author: '',
    subject: '',
    description: '',
    gradeLevel: '9',
    type: 'textbook' as LibraryBook['type'],
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

      const progress = await listReadingProgress(user.id).catch(() => []);
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
      if (activeSection === 'community') {
        const minGrade = user?.role === 'student' ? 5 : 1;
        return inQuery && inSubject && inGrade && (book.grade_level || minGrade) >= minGrade;
      }
      return inQuery && inSubject && inGrade;
    });
  }, [books, search, subjectFilter, gradeFilter, activeSection, user?.id, user?.role]);

  const visibleBooks = filteredBooks.slice(0, visibleCount);

  const subjects = useMemo(() => Array.from(new Set(books.map((b) => b.subject))).sort(), [books]);

  const resetForm = () => {
    setForm({ title: '', author: '', subject: '', description: '', gradeLevel: '9', type: 'textbook', file: null });
    setEditingBookId(null);
  };

  const canUpload = !!user && (user.role === 'teacher' || user.role === 'admin' || user.role === 'manager' || user.role === 'student');

  const handleUploadOrEdit = async () => {
    if (!user) return;

    if (!form.title.trim() || !form.author.trim() || !form.subject.trim() || !form.description.trim()) {
      toast.error('Please fill all metadata fields.');
      return;
    }

    if (user.role === 'student') {
      const g = Number(form.gradeLevel);
      if (g < 5 || g > 12) {
        toast.error('Students can upload for Grade 5 to Grade 12 only.');
        return;
      }
    }

    setUploading(true);

    try {
      if (editingBookId) {
        await updateBook(editingBookId, {
          title: form.title,
          author: form.author,
          subject: form.subject,
          description: form.description,
          grade_level: Number(form.gradeLevel),
          type: form.type,
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

        const created = await createBook({
          title: form.title,
          author: form.author,
          subject: form.subject,
          description: form.description,
          gradeLevel: Number(form.gradeLevel),
          type: form.type,
          pdfFile: form.file,
          uploaderId: user.id,
          uploaderRole: user.role,
        });
        toast.success(created.status === 'approved' ? 'Book uploaded to library.' : 'Book uploaded and waiting for approval.');
      }

      await load();
      setOpenUpload(false);
      resetForm();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Action failed. Try again.';
      toast.error(message);
    } finally {
      setUploading(false);
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

  const openReader = (book: LibraryBook) => {
    setSelectedBook(book);
    setReaderOpen(true);
    setReaderPageText('');
    setSelectedText('');
    setAiOutput('');
    setFlashcards([]);
  };

  const runAi = async (action: AiAction) => {
    if (!selectedBook || !user) return;
    const baseText = selectedText || readerPageText;
    const output = generateAiContent(action, baseText, Number(user.grade || 9));
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
          source_excerpt: (baseText || '').slice(0, 250),
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

  if (!user) return null;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2">
          <BackButton />
          <h1 className="text-2xl md:text-3xl font-bold">Master Minds AI Library</h1>
          {canUpload && (
            <Dialog open={openUpload} onOpenChange={setOpenUpload}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} className="gap-2">
                  <Upload className="h-4 w-4" /> Upload Book
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingBookId ? 'Edit Book Details' : 'Upload New Library Book'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  <div>
                    <Label>Book title</Label>
                    <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Author</Label>
                    <Input value={form.author} onChange={(e) => setForm((p) => ({ ...p, author: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Subject</Label>
                      <Input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Grade (1-12)</Label>
                      <Input type="number" min={1} max={12} value={form.gradeLevel} onChange={(e) => setForm((p) => ({ ...p, gradeLevel: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(value: LibraryBook['type']) => setForm((p) => ({ ...p, type: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="textbook">Textbook</SelectItem>
                        <SelectItem value="notes">Notes</SelectItem>
                        <SelectItem value="practice">Practice Book</SelectItem>
                        <SelectItem value="reference">Reference</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Short description</Label>
                    <Textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                  </div>
                  {!editingBookId && (
                    <div>
                      <Label>PDF file</Label>
                      <Input type="file" accept="application/pdf" onChange={(e) => setForm((p) => ({ ...p, file: e.target.files?.[0] || null }))} />
                    </div>
                  )}
                  <Button className="w-full" onClick={handleUploadOrEdit} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {editingBookId ? 'Save Changes' : 'Upload to Library'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Library</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {([
                ['my-books', 'My Books'],
                ['assigned', 'Assigned Books'],
                ['community', 'Community Library'],
                ['upload', 'Upload Book'],
                ['highlights', 'Highlights'],
                ['notes', 'Saved Notes'],
              ] as [SectionKey, string][]).map(([key, label]) => (
                <Button key={key} variant={activeSection === key ? 'default' : 'ghost'} className="w-full justify-start" onClick={() => {
                  setActiveSection(key);
                  if (key === 'upload') setOpenUpload(true);
                }}>{label}</Button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            {(activeSection === 'community' || activeSection === 'my-books') && (
              <Card>
                <CardContent className="p-4 grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search by title, author, subject, uploader" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                    <SelectTrigger><SelectValue placeholder="All subjects" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subjects</SelectItem>
                      {subjects.map((subject) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={gradeFilter} onValueChange={setGradeFilter}>
                    <SelectTrigger><SelectValue placeholder="All grades" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All grades</SelectItem>
                      {Array.from({ length: 12 }).map((_, index) => <SelectItem key={index + 1} value={String(index + 1)}>Grade {index + 1}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {activeSection === 'assigned' && (
              <Card>
                <CardHeader><CardTitle>Assigned Books</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {assignedBooks.length === 0 && <p className="text-sm text-muted-foreground">No assigned books yet.</p>}
                  {assignedBooks.map((book) => (
                    <div key={book.id} className="flex items-center justify-between gap-2 border rounded-lg p-3">
                      <div>
                        <p className="font-medium">{book.title}</p>
                        <p className="text-xs text-muted-foreground">{book.subject} • Grade {book.grade_level || '-'}</p>
                      </div>
                      <Button size="sm" onClick={() => openReader(book)}><BookOpen className="h-4 w-4 mr-2" />Read</Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {(activeSection === 'highlights' || activeSection === 'notes') && (
              <Card>
                <CardHeader><CardTitle>{activeSection === 'highlights' ? 'My Highlights' : 'Saved Notes'}</CardTitle></CardHeader>
                <CardContent className="space-y-3 max-h-[60vh] overflow-auto">
                  {highlights.length === 0 && <p className="text-sm text-muted-foreground">Nothing saved yet.</p>}
                  {highlights.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3">
                      <Badge variant="secondary" className="mb-2">{item.highlight_color}</Badge>
                      <p className="text-sm">{item.selected_text}</p>
                      {item.note && <p className="text-xs text-muted-foreground mt-2">📝 {item.note}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {(activeSection === 'community' || activeSection === 'my-books') && (
              loading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-10 w-10 animate-spin" /></div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence>
                      {visibleBooks.map((book) => {
                        const thumbnailUrl = getThumbnailPublicUrl(book.thumbnail_path);
                        const pdfUrl = getPdfPublicUrl(book.pdf_path);
                        const isBookmarked = bookmarkSet.has(book.id);

                        return (
                          <motion.div
                            key={book.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            whileHover={{ y: -4 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Card className="h-full border-white/20 bg-card/90 backdrop-blur-sm">
                              <CardContent className="p-4 space-y-3">
                                <div className="aspect-[4/3] rounded-md overflow-hidden bg-muted flex items-center justify-center">
                                  {thumbnailUrl ? (
                                    <img src={thumbnailUrl} className="w-full h-full object-cover" alt={book.title} />
                                  ) : (
                                    <div className="text-sm text-muted-foreground px-3 text-center">Thumbnail unavailable</div>
                                  )}
                                </div>

                                <div className="space-y-1">
                                  <h3 className="font-semibold line-clamp-2">{book.title}</h3>
                                  <p className="text-sm text-muted-foreground">{book.author}</p>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge>{book.subject}</Badge>
                                    <Badge variant="outline">Grade {book.grade_level || '-'}</Badge>
                                    <Badge variant="secondary" className="capitalize">{book.type}</Badge>
                                    <Badge variant={book.status === 'approved' ? 'default' : 'destructive'}>{book.status}</Badge>
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <User className="h-3 w-3" /> {book.profiles?.name || 'Unknown uploader'}
                                  </div>
                                </div>

                                <p className="text-sm text-muted-foreground line-clamp-3">{book.description}</p>

                                <div className="flex gap-2 flex-wrap">
                                  <Button size="sm" className="gap-2" onClick={() => openReader(book)}>
                                    <BookOpen className="h-4 w-4" /> Read
                                  </Button>
                                  <Button asChild size="sm" variant="outline" className="gap-2">
                                    <a href={pdfUrl} target="_blank" rel="noreferrer">
                                      <Download className="h-4 w-4" /> Download
                                    </a>
                                  </Button>

                                  {user.role === 'student' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-2"
                                      onClick={async () => {
                                        try {
                                          const next = await toggleBookmark(book.id, user.id, isBookmarked);
                                          setBookmarkSet((prev) => {
                                            const set = new Set(prev);
                                            if (next) set.add(book.id);
                                            else set.delete(book.id);
                                            return set;
                                          });
                                        } catch {
                                          toast.error('Bookmark action failed.');
                                        }
                                      }}
                                    >
                                      {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                                      {isBookmarked ? 'Saved' : 'Save'}
                                    </Button>
                                  )}

                                  {canManageBook(book) && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                          setEditingBookId(book.id);
                                          setForm({
                                            title: book.title,
                                            author: book.author,
                                            subject: book.subject,
                                            description: book.description,
                                            gradeLevel: String(book.grade_level || 9),
                                            type: book.type,
                                            file: null,
                                          });
                                          setOpenUpload(true);
                                        }}
                                      >
                                        Edit
                                      </Button>
                                      {book.status !== 'approved' && (user.role === 'teacher' || user.role === 'admin' || user.role === 'manager') && (
                                        <>
                                          <Button size="sm" onClick={async () => {
                                            await moderateBookUpload({
                                              bookId: book.id,
                                              moderatorId: user.id,
                                              status: 'approved',
                                              note: 'Approved by moderator',
                                            });
                                            toast.success('Book approved.');
                                            await load();
                                          }}>
                                            Approve
                                          </Button>
                                          <Button size="sm" variant="outline" onClick={async () => {
                                            await moderateBookUpload({
                                              bookId: book.id,
                                              moderatorId: user.id,
                                              status: 'rejected',
                                              note: 'Rejected by moderator',
                                            });
                                            toast.success('Book rejected.');
                                            await load();
                                          }}>
                                            Reject
                                          </Button>
                                        </>
                                      )}
                                      <Button size="sm" variant="destructive" onClick={() => handleDelete(book.id)}>
                                        Delete
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {visibleCount < filteredBooks.length && (
                    <div className="flex justify-center py-3">
                      <Button variant="outline" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>Load more</Button>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </div>

      <Dialog open={readerOpen} onOpenChange={setReaderOpen}>
        <DialogContent className="max-w-6xl h-[90vh] p-0 overflow-hidden">
          <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col h-full border-r">
              <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{selectedBook?.title || 'Reader'}</p>
                  <p className="text-xs text-muted-foreground">Progress: {Math.round(readerProgress)}%</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => markReaderProgress(Math.min(100, readerProgress + 10))}>+10%</Button>
                  <Button size="sm" variant="outline" onClick={() => markReaderProgress(Math.max(0, readerProgress - 10))}>-10%</Button>
                </div>
              </div>

              <div className="flex-1 bg-muted/30 p-2">
                {selectedBook && (
                  <iframe title={selectedBook.title} src={getPdfPublicUrl(selectedBook.pdf_path)} className="w-full h-full rounded-md bg-white" />
                )}
              </div>

              <div className="p-3 border-t grid gap-2 md:grid-cols-2">
                <Input placeholder="Paste selected text here for highlight/AI" value={selectedText} onChange={(e) => setSelectedText(e.target.value)} />
                <Input placeholder="Paste current page text (for better AI output)" value={readerPageText} onChange={(e) => setReaderPageText(e.target.value)} />
                <div className="flex flex-wrap gap-2 items-center">
                  <Button size="sm" variant={highlightColor === 'yellow' ? 'default' : 'outline'} onClick={() => setHighlightColor('yellow')}><Highlighter className="h-4 w-4 mr-2" />Yellow</Button>
                  <Button size="sm" variant={highlightColor === 'blue' ? 'default' : 'outline'} onClick={() => setHighlightColor('blue')}>Blue</Button>
                  <Button size="sm" variant={highlightColor === 'red' ? 'default' : 'outline'} onClick={() => setHighlightColor('red')}>Red</Button>
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add note" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <Button size="sm" onClick={saveHighlight}>Save</Button>
                </div>
              </div>
            </div>

            <div className="h-full overflow-auto p-3 space-y-3">
              <p className="font-semibold flex items-center gap-2"><Brain className="h-4 w-4" />AI Tools</p>
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => runAi('summary')}>Summarize</Button>
                <Button size="sm" variant="outline" onClick={() => runAi('simple')}>Explain Simply</Button>
                <Button size="sm" variant="outline" onClick={() => runAi('questions')}>Generate Questions</Button>
                <Button size="sm" variant="outline" onClick={() => runAi('flashcards')}>Create Flashcards</Button>
                <Button size="sm" variant="outline" className="col-span-2" onClick={() => runAi('concepts')}>Find Key Concepts</Button>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">AI Output</CardTitle></CardHeader>
                <CardContent>
                  <pre className="text-xs whitespace-pre-wrap font-sans">{aiOutput || 'Run an AI action from above.'}</pre>
                </CardContent>
              </Card>

              {flashcards.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Generated Flashcards</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {flashcards.map((card, idx) => (
                      <div key={idx} className="rounded border p-2">
                        <p className="text-xs font-medium">Front: {card.front}</p>
                        <p className="text-xs text-muted-foreground">Back: {card.back}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-sm">Saved AI Questions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {savedQuestions.slice(0, 10).map((q) => (
                    <div key={q.id || `${q.question}-${q.answer}`} className="rounded border p-2">
                      <p className="text-xs font-medium">Q: {q.question}</p>
                      <p className="text-xs text-muted-foreground">A: {q.answer}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LibraryPage;
