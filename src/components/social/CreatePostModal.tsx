import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/context/UserContext';
import { toast } from 'sonner';
import { X, Image as ImageIcon, Send, Loader2 } from 'lucide-react';

interface CreatePostModalProps {
  onClose: () => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ onClose }) => {
  const { user } = useUser();
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handlePost = async () => {
    const auth = await supabase.auth.getUser();
    if (!content.trim() || !auth.data.user?.id) return;

    setIsPosting(true);
    try {
      let imagePath: string | null = null;

      if (imageFile) {
        const ext = imageFile.name.split('.').pop();
        const path = `${auth.data.user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('social-images')
          .upload(path, imageFile);
        if (uploadErr) throw uploadErr;
        imagePath = path;
      }

      const { error } = await supabase.from('social_posts').insert({
        author_id: auth.data.user.id,
        content: content.trim(),
        image_url: imagePath,
        post_type: 'post',
      });

      if (error) throw error;

      toast.success('Posted!');
      onClose();
    } catch (error) {
      console.error('Post error:', error);
      toast.error('Failed to create post');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-sm">Create Post</span>
        <Button
          size="sm"
          className="rounded-full px-5"
          disabled={isPosting || !content.trim()}
          onClick={handlePost}
        >
          {isPosting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          Post
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 py-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-muted text-foreground font-semibold">
              {user?.name?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-2">{user?.name || 'You'}</p>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind? Share wins, study tips, or ask for help..."
              className="min-h-[120px] resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0 shadow-none"
              autoFocus
            />
          </div>
        </div>

        {imagePreview && (
          <div className="mt-4 relative">
            <img src={imagePreview} alt="Preview" className="rounded-xl max-h-72 w-full object-cover" />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full"
              onClick={() => { setImageFile(null); setImagePreview(null); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/40 px-4 py-3 flex items-center gap-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
        <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
          <ImageIcon className="h-5 w-5 mr-1 text-primary" />
          Photo
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{content.length}/500</span>
      </div>
    </div>
  );
};

export default CreatePostModal;
