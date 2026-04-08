import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/context/UserContext';
import { toast } from 'sonner';
import AnimatedBackground from '@/components/ui/AnimatedBackground';
import BackButton from '@/components/ui/BackButton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bookmark, BookmarkCheck, Download, Loader2, Search, Upload, User } from 'lucide-react';
import {
  createBook,
  deleteBook,
  getPdfPublicUrl,
  getThumbnailPublicUrl,
  LibraryBook,
  listBookmarks,
  listBooks,
  toggleBookmark,
  updateBook,
} from '@/lib/libraryApi';

const PAGE_SIZE = 9;

const LibraryPage: React.FC = () => {
  const { user } = useUser();

  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [bookmarkSet, setBookmarkSet] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [uploaderFilter, setUploaderFilter] = useState('all');

  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    author: '',
    subject: '',
    description: '',
    file: null as File | null,
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [bookData, bookmarks] = await Promise.all([listBooks(), listBookmarks(user.id)]);
      setBooks(bookData);
      setBookmarkSet(bookmarks);
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
      const inUploader = uploaderFilter === 'all' || book.uploader_role === uploaderFilter;

      return inQuery && inSubject && inUploader;
    });
  }, [books, search, subjectFilter, uploaderFilter]);

  const visibleBooks = filteredBooks.slice(0, visibleCount);

  const subjects = useMemo(() => Array.from(new Set(books.map((b) => b.subject))).sort(), [books]);

  const resetForm = () => {
    setForm({ title: '', author: '', subject: '', description: '', file: null });
    setEditingBookId(null);
  };

  const handleUploadOrEdit = async () => {
    if (!user) return;

    if (!form.title.trim() || !form.author.trim() || !form.subject.trim() || !form.description.trim()) {
      toast.error('Please fill all metadata fields.');
      return;
    }

    setUploading(true);

    try {
      if (editingBookId) {
        await updateBook(editingBookId, {
          title: form.title,
          author: form.author,
          subject: form.subject,
          description: form.description,
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

        await createBook({
          title: form.title,
          author: form.author,
          subject: form.subject,
          description: form.description,
          pdfFile: form.file,
          uploaderId: user.id,
          uploaderRole: user.role,
        });
        toast.success('Book uploaded to library.');
      }

      await load();
      setOpenUpload(false);
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('Action failed. Try again.');
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
    if (user.role === 'admin' || user.role === 'manager') return true;
    return book.uploader_id === user.id;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 p-4 md:p-6 max-w-7xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <BackButton />
          <h1 className="text-2xl md:text-3xl font-bold">Master Minds Library</h1>
          <Dialog open={openUpload} onOpenChange={setOpenUpload}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} className="gap-2">
                <Upload className="h-4 w-4" /> Upload PDF
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
                <div>
                  <Label>Subject / Type</Label>
                  <Input value={form.subject} onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
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
        </div>

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
            <Select value={uploaderFilter} onValueChange={setUploaderFilter}>
              <SelectTrigger><SelectValue placeholder="All uploaders" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All uploaders</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
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
                              <Badge variant="secondary" className="capitalize">{book.uploader_role}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> {book.profiles?.name || 'Unknown uploader'}
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground line-clamp-3">{book.description}</p>

                          <div className="flex gap-2 flex-wrap">
                            <Button asChild size="sm" className="gap-2">
                              <a href={pdfUrl} target="_blank" rel="noreferrer">
                                <Download className="h-4 w-4" /> Download / View
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
                                      file: null,
                                    });
                                    setOpenUpload(true);
                                  }}
                                >
                                  Edit
                                </Button>
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
        )}
      </div>
    </div>
  );
};

export default LibraryPage;
