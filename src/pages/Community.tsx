import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { dbService } from '../services/dbService';
import { UserProfile, CommunityPost, CommunityComment, PostType, PostCategory } from '../types';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import Loading from '../components/Loading';
import { 
  Plus, 
  Search, 
  MessageSquare, 
  ThumbsUp, 
  Eye, 
  Clock, 
  ChevronLeft, 
  Send,
  MoreVertical,
  Filter,
  Users,
  Briefcase,
  Code,
  GraduationCap,
  Globe,
  Tag as TagIcon,
  X,
  Coffee
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn, formatDate, formatTime, formatDateTime } from '../lib/utils';
import matchaIcon from '../lib/Matcha Latte Icon.png';

interface CommunityProps {
  userProfile: UserProfile;
}

export default function Community({ userProfile }: CommunityProps) {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PostCategory | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<PostType | 'all'>('all');
  const [activeSort, setActiveSort] = useState<'latest' | 'popular' | 'unanswered'>('latest');

  // Create Post State
  const [newPost, setNewPost] = useState<{
    title: string;
    content: string;
    type: PostType;
    category: PostCategory;
    isAnonymous: boolean;
    tags: string[];
  }>({
    title: '',
    content: '',
    type: 'question',
    category: 'general',
    isAnonymous: false,
    tags: []
  });

  // Fetch Posts
  useEffect(() => {
    const fetchPosts = async () => {
      try {
        let fetchedPosts = await dbService.getPosts();

        // Client-side filtering
        if (categoryFilter !== 'all') {
          fetchedPosts = fetchedPosts.filter(p => p.category === categoryFilter);
        }

        if (typeFilter !== 'all') {
          fetchedPosts = fetchedPosts.filter(p => p.type === typeFilter);
        }

        if (searchQuery) {
          const lowerQuery = searchQuery.toLowerCase();
          fetchedPosts = fetchedPosts.filter(p => 
            p.title.toLowerCase().includes(lowerQuery) || 
            p.content.toLowerCase().includes(lowerQuery) ||
            p.tags?.some(t => t.toLowerCase().includes(lowerQuery))
          );
        }

        // Sort
        if (activeSort === 'unanswered') {
          fetchedPosts = fetchedPosts
            .filter(p => p.type === 'question' && p.commentCount === 0);
        } else if (activeSort === 'popular') {
          fetchedPosts.sort((a, b) => (b.likeCount + b.commentCount) - (a.likeCount + a.commentCount));
        }

        setPosts(fetchedPosts);
      } catch (err) {
        console.error("Board Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
    const interval = setInterval(fetchPosts, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [categoryFilter, typeFilter, activeSort, searchQuery]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.title.trim() || !newPost.content.trim()) return;

    try {
      const postId = Math.random().toString(36).substring(7);
      await dbService.createPost({
        id: postId,
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        authorAvatar: userProfile.avatarUrl || '',
        title: newPost.title,
        content: newPost.content,
        type: newPost.type,
        category: newPost.category,
        isAnonymous: newPost.isAnonymous,
        tags: newPost.tags,
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setShowCreateModal(false);
      setNewPost({
        title: '',
        content: '',
        type: 'question',
        category: 'general',
        isAnonymous: false,
        tags: []
      });
    } catch (error) {
      console.error("Create post error:", error);
    }
  };

  const handleLikePost = async (postId: string, postLikes?: string[]) => {
    try {
      const isLiking = !postLikes?.includes(userProfile.uid);
      await dbService.likePost(postId, userProfile.uid, isLiking);
      // Optimistic update
      setPosts(prev => prev.map(p => p.id === postId ? { 
        ...p, 
        likeCount: (p.likeCount || 0) + (isLiking ? 1 : -1),
        likes: isLiking 
          ? [...(p.likes || []), userProfile.uid] 
          : (p.likes || []).filter(id => id !== userProfile.uid)
      } : p));
    } catch (error) {
      console.error("Like error:", error);
    }
  };

  const incrementViewCount = async (postId: string) => {
    // Optional: could add an API for this
  };

  const calculateReadingTime = (content: string) => {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return minutes;
  };

  const selectedPost = posts.find(p => p.id === selectedPostId);

  return (
    <div className="flex-1 flex flex-col h-full bg-dark overflow-hidden">
      {/* Header with Search and Sort */}
      <header className="p-4 border-b border-white/10 glass sticky top-0 z-20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={matchaIcon} className="w-8 h-8 object-contain" alt="Matcha" />
            <h1 className="text-2xl font-display font-bold">Matcha Board</h1>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="w-10 h-10 rounded-full bg-brand text-dark flex items-center justify-center shadow-lg shadow-brand/20 hover:scale-105 active:scale-95 transition-transform"
          >
            <Plus size={24} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
            <input 
              type="text" 
              placeholder="Search conversations, tips, or questions..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-brand/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <FilterChip active={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} icon={<Globe size={14} />} label="All" />
            <FilterChip active={categoryFilter === 'career'} onClick={() => setCategoryFilter('career')} icon={<Briefcase size={14} />} label="Career" />
            <FilterChip active={categoryFilter === 'tech'} onClick={() => setCategoryFilter('tech')} icon={<Code size={14} />} label="Tech" />
            <FilterChip active={categoryFilter === 'mentorship'} onClick={() => setCategoryFilter('mentorship')} icon={<Users size={14} />} label="Mentorship" />
          </div>
        </div>
      </header>

      {/* Main Feed */}
      <main className="flex-1 overflow-y-auto p-4 pb-32 space-y-4 custom-scrollbar">
        {/* Sort Tabs */}
        <div className="flex items-center p-1 bg-white/5 rounded-xl self-start">
          <SortButton active={activeSort === 'latest'} onClick={() => setActiveSort('latest')}>Latest</SortButton>
          <SortButton active={activeSort === 'popular'} onClick={() => setActiveSort('popular')}>Popular</SortButton>
          <SortButton active={activeSort === 'unanswered'} onClick={() => setActiveSort('unanswered')}>Unanswered</SortButton>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><Loading /></div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center space-y-6 flex flex-col items-center">
            <div className="w-20 h-20 bg-brand/10 rounded-full flex items-center justify-center text-brand">
              <Coffee size={40} />
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">The Board is Quiet</h3>
              <p className="text-white/40 text-xs max-w-[240px] mx-auto uppercase tracking-widest leading-relaxed">
                Be the first to whisk up a conversation or share an internship experience!
              </p>
            </div>
            {userProfile.email?.toLowerCase() === 'prabhsharansethiapps@gmail.com' && (
              <button 
                onClick={() => navigate('/profile')}
                className="bg-brand text-dark px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform"
              >
                Go to Profile to Seed Board
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                currentUserId={userProfile.uid}
                onLike={() => handleLikePost(post.id, post.likes)}
                onClick={() => {
                  setSelectedPostId(post.id);
                  incrementViewCount(post.id);
                }}
                readingTime={calculateReadingTime(post.content)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreatePostModal 
            newPost={newPost}
            setNewPost={setNewPost}
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreatePost}
          />
        )}
      </AnimatePresence>

      {/* Post Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <PostDetailModal 
            post={selectedPost}
            userProfile={userProfile}
            onClose={() => setSelectedPostId(null)}
            onLike={() => handleLikePost(selectedPost.id, selectedPost.likes)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterChip({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all border",
        active ? "bg-brand text-dark border-brand" : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function SortButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
        active ? "bg-brand text-dark shadow-sm" : "text-white/40 hover:text-white/60"
      )}
    >
      {children}
    </button>
  );
}

function PostCard({ post, currentUserId, onLike, onClick, readingTime }: { 
  post: CommunityPost, 
  currentUserId: string,
  onLike: () => void, 
  onClick: () => void,
  readingTime: number
}) {
  const isLiked = false; // We simplified like logic to just increment for now
  const isArticle = post.type === 'article';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass p-5 rounded-3xl border-white/10 hover:border-brand/30 transition-all group cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {post.isAnonymous ? (
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40">
              <Users size={16} />
            </div>
          ) : (
            <img src={post.authorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} className="w-8 h-8 rounded-full object-cover" alt="" />
          )}
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white/80">{post.isAnonymous ? 'Anonymous Member' : post.authorName}</span>
            <span className="text-[8px] text-white/40 uppercase tracking-tighter">
              {formatDate(post.createdAt)}
            </span>
          </div>
        </div>
        <div className={cn(
          "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-[0.2em]",
          isArticle ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-brand/10 text-brand border border-brand/20"
        )}>
          {post.type}
        </div>
      </div>

      <h3 className="text-lg font-display font-bold mb-2 group-hover:text-brand transition-colors leading-tight">{post.title}</h3>
      <p className="text-white/60 text-xs line-clamp-3 mb-4 leading-relaxed font-medium">{post.content}</p>

      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {post.tags.map(tag => (
            <span key={tag} className="text-[8px] text-white/40 bg-white/5 px-2 py-1 rounded-md">#{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-4 text-white/40">
          <button 
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            className={cn("flex items-center gap-1.5 hover:text-brand transition-all", isLiked && "text-brand")}
          >
            <ThumbsUp size={14} />
            <span className="text-[10px] font-bold">{post.likeCount || 0}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <MessageSquare size={14} />
            <span className="text-[10px] font-bold">{post.commentCount || 0}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye size={14} />
            <span className="text-[10px] font-bold">{post.viewCount || 0}</span>
          </div>
        </div>
        
        {isArticle && (
          <div className="flex items-center gap-1 text-[8px] text-white/30 uppercase tracking-tighter">
            <Clock size={10} />
            <span>{readingTime} min read</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CreatePostModal({ newPost, setNewPost, onClose, onSubmit }: { 
  newPost: any, 
  setNewPost: any, 
  onClose: () => void, 
  onSubmit: (e: React.FormEvent) => void 
}) {
  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    if (tagInput.trim() && !newPost.tags.includes(tagInput.trim())) {
      setNewPost({ ...newPost, tags: [...newPost.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-dark/80 backdrop-blur-sm p-4"
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full max-w-xl bg-[#0F0F0F] border border-white/10 rounded-t-[40px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-display font-bold">New Post</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/60">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="flex flex-wrap gap-2">
            <TypeSelect active={newPost.type === 'question'} onClick={() => setNewPost({ ...newPost, type: 'question'})} label="Question" />
            <TypeSelect active={newPost.type === 'article'} onClick={() => setNewPost({ ...newPost, type: 'article'})} label="Article" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Category</label>
            <select 
              value={newPost.category}
              onChange={(e) => setNewPost({ ...newPost, category: e.target.value as PostCategory })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-brand/50 appearance-none"
            >
              <option value="general">General Campus</option>
              <option value="career">Job & Career</option>
              <option value="tech">Tech & Innovation</option>
              <option value="mentorship">Mentorship</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Title</label>
            <input 
              type="text" 
              placeholder={newPost.type === 'question' ? "What's on your mind?" : "Title of your experience..."}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-brand/50"
              value={newPost.title}
              onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Content</label>
            <textarea 
              placeholder={newPost.type === 'question' ? "Provide more details for your question..." : "Share your full story or tips here..."}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-brand/50 min-h-[150px] resize-none"
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              required
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Tags</label>
            </div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Add a tag..."
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              />
              <button 
                type="button" 
                onClick={addTag}
                className="bg-white/10 px-4 rounded-2xl hover:bg-white/20 transition-colors"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-white/40">
              {newPost.tags.map((tag: string) => (
                <span key={tag} className="flex items-center gap-2 bg-brand/10 text-brand px-3 py-1 rounded-lg text-xs font-bold">
                  #{tag}
                  <button onClick={() => setNewPost({ ...newPost, tags: newPost.tags.filter((t: string) => t !== tag)})} className="hover:text-white">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl">
            <input 
              type="checkbox" 
              checked={newPost.isAnonymous}
              onChange={(e) => setNewPost({ ...newPost, isAnonymous: e.target.checked })}
              className="w-5 h-5 rounded-lg border-white/20 bg-dark checked:bg-brand"
            />
            <div className="flex flex-col">
              <span className="text-xs font-bold">Post Anonymously</span>
              <span className="text-[10px] text-white/40">Your name and profile will be hidden.</span>
            </div>
          </div>
        </form>

        <div className="p-6 bg-white/5 border-t border-white/10">
          <button 
            onClick={onSubmit}
            className="w-full bg-brand text-dark py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-brand/20 active:scale-[0.98] transition-transform"
          >
            Sip and Send
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TypeSelect({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={cn(
        "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
        active ? "bg-brand text-dark" : "bg-white/5 text-white/40 border border-white/10"
      )}
    >
      {label}
    </button>
  );
}

function PostDetailModal({ post, userProfile, onClose, onLike }: { 
  post: CommunityPost, 
  userProfile: UserProfile, 
  onClose: () => void,
  onLike: () => void
}) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchComments = async () => {
    try {
      const fetched = await dbService.getComments(post.id);
      setComments(fetched);
    } catch (err) {
      console.error("Comments fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
    const interval = setInterval(fetchComments, 5000);
    return () => clearInterval(interval);
  }, [post.id]);

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const commentId = Math.random().toString(36).substring(7);
      const commentData: CommunityComment = {
        id: commentId,
        postId: post.id,
        authorId: userProfile.uid,
        authorName: userProfile.displayName,
        authorAvatar: userProfile.avatarUrl || '',
        text: newComment,
        isAnonymous,
        createdAt: new Date().toISOString()
      };

      await dbService.addComment(post.id, commentData);
      setNewComment('');
      fetchComments();
    } catch (error) {
      console.error("Comment send error:", error);
    }
  };

  const isLiked = false;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-dark"
    >
      <header className="p-4 border-b border-white/10 glass flex items-center justify-between">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white/60">
          <ChevronLeft size={24} />
        </button>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">{post.type}</span>
        <button className="p-2 hover:bg-white/10 rounded-full text-white/60">
          <MoreVertical size={20} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar" ref={scrollRef}>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            {post.isAnonymous ? (
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40">
                <Users size={20} />
              </div>
            ) : (
              <img src={post.authorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.authorId}`} className="w-10 h-10 rounded-full object-cover" alt="" />
            )}
            <div>
              <h3 className="text-sm font-bold">{post.isAnonymous ? 'Anonymous Member' : post.authorName}</h3>
              <p className="text-[10px] text-white/40 uppercase tracking-tighter">
                {formatDateTime(post.createdAt)}
              </p>
            </div>
          </div>

          <h1 className="text-3xl font-display font-bold leading-tight">{post.title}</h1>
          
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-brand/10 text-brand rounded-lg text-[10px] font-black uppercase tracking-widest">{post.category}</span>
            {post.tags?.map(tag => (
              <span key={tag} className="px-3 py-1 bg-white/5 text-white/40 rounded-lg text-[10px] font-bold">#{tag}</span>
            ))}
          </div>

          <div className="text-white/80 text-sm leading-[1.8] font-medium whitespace-pre-wrap">
            {post.content}
          </div>

          <div className="flex items-center gap-6 py-4 border-y border-white/10">
            <button onClick={onLike} className={cn("flex items-center gap-2 transition-colors font-bold text-xs uppercase tracking-widest", isLiked ? "text-brand" : "text-white/40")}>
              <ThumbsUp size={18} /> {post.likeCount || 0}
            </button>
            <div className="flex items-center gap-2 text-white/40 font-bold text-xs uppercase tracking-widest">
              <MessageSquare size={18} /> {post.commentCount || 0}
            </div>
            <div className="flex items-center gap-2 text-white/40 font-bold text-xs uppercase tracking-widest">
              <Eye size={18} /> {post.viewCount || 0}
            </div>
          </div>
        </div>

        {/* Comments Section */}
        <div className="space-y-6">
          <h4 className="text-xs font-black uppercase tracking-widest text-white/40">Discussions</h4>
          {loading ? (
            <div className="flex justify-center"><Loading /></div>
          ) : comments.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs text-white/20 italic">No thoughts yet. Be the first to brew some insight!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3 group animate-in slide-in-from-bottom-2 fade-in duration-300">
                  {comment.isAnonymous ? (
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 shrink-0">
                      <Users size={14} />
                    </div>
                  ) : (
                    <img src={comment.authorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.authorId}`} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black">{comment.isAnonymous ? 'Anonymous' : comment.authorName}</span>
                       <span className="text-[8px] text-white/20 uppercase tracking-tighter">
                         {formatTime(comment.createdAt)}
                       </span>
                    </div>
                    <p className="text-xs text-white/70 leading-relaxed font-medium bg-white/5 p-3 rounded-2xl rounded-tl-none">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Comment Input */}
      <div className="p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] bg-dark/80 backdrop-blur-xl border-t border-white/10 shrink-0">
        <form onSubmit={handleSendComment} className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative flex items-center">
              <input 
                type="text" 
                placeholder="Add to the conversation..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3 pr-12 text-sm focus:outline-none focus:border-brand/40"
              />
              <button 
                type="submit"
                disabled={!newComment.trim()}
                className="absolute right-2 p-2 text-brand hover:scale-110 active:scale-95 transition-transform disabled:opacity-20"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 px-1">
            <button 
              type="button"
              onClick={() => setIsAnonymous(!isAnonymous)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all",
                isAnonymous ? "bg-brand/20 text-brand outline outline-1 outline-brand/40" : "bg-white/5 text-white/40"
              )}
            >
              <Users size={12} /> Anonymous
            </button>
            <span className="text-[8px] text-white/20 italic font-medium ml-2">Keep it professional and helpful.</span>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
