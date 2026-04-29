import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, logOut } from '../lib/firebase';
import { dbService } from '../services/dbService';
import { UserProfile } from '../types';
import { LogOut, Save, Pencil, Info, Beaker, Trash2, AlertTriangle, Calendar, ChevronDown, Check, Loader2, Coffee } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { cn } from '../lib/utils';
import AvailabilitySelector from '../components/AvailabilitySelector';
import ImageCropperModal from '../components/ImageCropperModal';
import { AnimatePresence } from 'framer-motion';

interface ProfileProps {
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
}

const ADMIN_EMAIL = 'prabhsharans0@gmail.com';

export default function Profile({ profile, onUpdate }: ProfileProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Cropper State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);

  const [formData, setFormData] = useState({
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl || '',
    bio: profile.bio || '',
    major: profile.major || '',
    interests: profile.interests?.join(', ') || '',
    role: profile.role,
    weeklyAvailability: profile.weeklyAvailability || {},
    isMentor: profile.isMentor ?? false,
  });

  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isFirstRender, setIsFirstRender] = useState(true);
  const isAdmin = profile.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Autosave effect
  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        // Deep check to prevent redundant writes
        if (
          formData.displayName === profile.displayName &&
          formData.avatarUrl === (profile.avatarUrl || '') &&
          formData.bio === (profile.bio || '') &&
          formData.major === (profile.major || '') &&
          formData.role === profile.role &&
          formData.isMentor === (profile.isMentor ?? false)
        ) {
          setSaveStatus('idle');
          return;
        }

        const updatedProfile: UserProfile = {
          ...profile,
          displayName: formData.displayName,
          avatarUrl: formData.avatarUrl,
          bio: formData.bio,
          major: formData.major,
          interests: formData.interests.split(',').map(s => s.trim()).filter(s => s !== ''),
          role: formData.role as any,
          weeklyAvailability: formData.weeklyAvailability,
          isMentor: formData.isMentor,
          updatedAt: new Date().toISOString(),
        };

        await dbService.saveUser(updatedProfile);

        onUpdate(updatedProfile);
        setSaveStatus('saved');
        // Clear "saved" status after 3 seconds
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (err) {
        console.error("Autosave error:", err);
        setSaveStatus('error');
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [formData]);

  const seedCommunityBoard = async () => {
    setSeeding(true);
    try {
      const posts = [
        {
          title: "How to land a first-year internship in Toronto?",
          content: "Hi everyone! I'm a freshman in CS and I was wondering what the landscape looks like for first-year internships. Are there specific companies that hire freshmen in the city? Any advice on resume building would be great!",
          type: 'question' as const,
          category: 'career' as const,
          tags: ['freshman', 'internship', 'advice'],
          authorName: 'Sarah (Professional Bot)',
          authorId: 'test_bot_cheers',
          isAnonymous: false
        },
        {
          title: "My Experience as a Quant Intern at Jane Street",
          content: "I wanted to share my journey of interviewing and working as a Quant intern last summer. The interview was heavy on probability and market intuition. During the internship, I worked on...",
          type: 'article' as const,
          category: 'tech' as const,
          tags: ['quant', 'internship', 'finance'],
          authorName: 'Alex (Alumni)',
          authorId: 'test_bot_alex',
          isAnonymous: false
        }
      ];

      for (const postData of posts) {
        await dbService.createPost({
          ...postData,
          id: Math.random().toString(36).substring(7),
          authorAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${postData.authorId}`,
          viewCount: Math.floor(Math.random() * 100),
          likeCount: Math.floor(Math.random() * 20),
          commentCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any);
      }

      alert('Board Seeding Complete!');
    } catch (err) {
      console.error("Board seeding error:", err);
      alert("Failed to seed board.");
    } finally {
      setSeeding(false);
    }
  };

  const handleSystemReset = async () => {
    setResetting(true);
    try {
      // 1. Delete all matches (and their messages)
      const matches = await dbService.getAllMatches();
      for (const m of matches) {
        await dbService.deleteMatch(m.id);
      }

      // 2. Delete all profiles including bots
      const users = await dbService.getUsers();
      for (const u of users) {
        await dbService.deleteUser(u.uid);
      }

      // 3. Delete all posts
      const posts = await dbService.getPosts();
      for (const p of posts) {
        await dbService.deletePost(p.id);
      }

      // Clear any local caches/storage
      localStorage.clear();
      sessionStorage.clear();

      alert('System Reset Complete! All data has been purged from Firestore and local storage.');
      setShowConfirmReset(false);
      
      // Force reload to completely reset state
      logOut().then(() => {
        window.location.href = '/';
      });
    } catch (err) {
      console.error("Full Reset Error:", err);
      alert("Failed to reset system correctly. Some records might persist.");
    } finally {
      setResetting(false);
    }
  };

  const seedTestMatch = async () => {
    setSeeding(true);
    try {
      // 1. Seed Users (Mentor/Mentee Bots)
      const bots: UserProfile[] = [
        {
          uid: 'test_bot_sarah',
          displayName: 'Sarah (Professional Bot)',
          email: 'sarah_test@example.com',
          avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop',
          bio: 'Senior Software Engineer with 8+ years of experience in full-stack development and distributed systems. Passionate about mentoring students and helping them navigate career paths.',
          major: 'Software Engineering',
          role: 'employer' as any,
          isMentor: true,
          interests: ['System Architecture', 'Career Growth', 'Cloud Computing'],
          weeklyAvailability: {
            'Monday': ['lunch', 'evening'],
            'Wednesday': ['lunch', 'afternoon'],
            'Friday': ['morning']
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          uid: 'test_bot_alex',
          displayName: 'Alex (Alumni Bot)',
          email: 'alex_test@example.com',
          avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop',
          bio: 'Recently graduated CS student now working in Fintech. I know the struggle of internships and would love to help current students with resume reviews.',
          major: 'Computer Science',
          role: 'upper-year' as any,
          isMentor: true,
          interests: ['Fintech', 'Resume Review', 'Python'],
          weeklyAvailability: {
            'Tuesday': ['evening'],
            'Thursday': ['evening'],
            'Saturday': ['morning']
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          uid: 'test_bot_marcus',
          displayName: 'Marcus (Tech Lead Bot)',
          email: 'marcus_test@example.com',
          avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop',
          bio: 'Tech Lead at a local startup. Looking to connect with ambitious students for potential internship opportunities in mobile development.',
          major: 'Mobile Development',
          role: 'employer' as any,
          isMentor: true,
          interests: ['Swift', 'Kotlin', 'React Native', 'Entrepreneurship'],
          weeklyAvailability: {
            'Monday': ['morning'],
            'Friday': ['afternoon']
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      ];

      for (const bot of bots) {
        await dbService.saveUser(bot);
        
        // 2. Create Matches (pre-emptive likes from bots to current user)
        const computedMatchId = [profile.uid, bot.uid].sort().join('_');
        const sortedUserIds = [profile.uid, bot.uid].sort();
        
        await dbService.saveMatch({
          id: computedMatchId,
          userIds: sortedUserIds,
          swipes: {
            [bot.uid]: 'liked'
          },
          status: 'liked',
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }

      // 3. Seed Community Posts
      const posts = [
        {
          title: "How to land a first-year internship in Toronto?",
          content: "Hi everyone! I'm a freshman in CS and I was wondering what the landscape looks like for first-year internships. Are there specific companies that hire freshmen in the city? Any advice on resume building would be great!",
          type: 'question' as const,
          category: 'career' as const,
          tags: ['freshman', 'internship', 'advice'],
          authorName: 'Sarah (Professional Bot)',
          authorId: 'test_bot_sarah',
          isAnonymous: false
        },
        {
          title: "My Experience as a Quant Intern at Jane Street",
          content: "I wanted to share my journey of interviewing and working as a Quant intern last summer. The interview was heavy on probability and market intuition. During the internship, I worked on alpha generation and risk management protocols.",
          type: 'article' as const,
          category: 'tech' as const,
          tags: ['quant', 'internship', 'finance'],
          authorName: 'Alex (Alumni Bot)',
          authorId: 'test_bot_alex',
          isAnonymous: false
        },
        {
          title: "Startup Coffee Chat: Mobile Dev Edition",
          content: "Hey students! Our startup is hosting an informal coffee chat this Friday for anyone interested in Flutter or Swift. No formal interview, just vibes. Come say hi!",
          type: 'discussion' as const,
          category: 'events' as const,
          tags: ['mobile', 'networking', 'startup'],
          authorName: 'Marcus (Tech Lead Bot)',
          authorId: 'test_bot_marcus',
          isAnonymous: false
        }
      ];

      for (const postData of posts) {
        await dbService.createPost({
          ...postData,
          id: Math.random().toString(36).substring(7),
          authorAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${postData.authorId}`,
          viewCount: Math.floor(Math.random() * 100) + 50,
          likeCount: Math.floor(Math.random() * 20) + 5,
          commentCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any);
      }

      alert('Full Demo Environment Seeded! Check your Discover page for matches and the Matcha Board for posts.');
    } catch (err) {
      console.error("Seeding error:", err);
      alert("Failed to seed demo environment.");
    } finally {
      setSeeding(false);
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Image is too large. Please select an image under 10MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setImageToCrop(event.target?.result as string);
        setIsCropping(true);
      };
      reader.readAsDataURL(file);
      // Reset input value to allow selecting same file again
      e.target.value = '';
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    setFormData(prev => ({ ...prev, avatarUrl: croppedImage }));
    setIsCropping(false);
    setImageToCrop(null);
  };

  return (
    <div className="flex-1 p-6 pb-32 max-w-2xl mx-auto w-full overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-display font-bold">Profile</h1>
        <button onClick={logOut} className="text-red-500 flex items-center gap-2 text-sm font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
          <LogOut size={18} /> Sign Out
        </button>
      </div>

      <div className="space-y-8">
        {/* Header Profile Section */}
        <div className="glass p-6 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            <img
              src={formData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.displayName)}&background=random&size=256`}
              alt={formData.displayName}
              className="w-24 h-24 rounded-full object-cover object-center border-4 border-brand"
            />
            <button 
              type="button" 
              onClick={handleImageClick}
              className="absolute bottom-0 right-0 bg-brand text-dark p-1.5 rounded-full border-4 border-dark hover:scale-110 active:scale-95 transition-all shadow-lg"
              aria-label="Edit profile picture"
            >
              <Pencil size={14} fill="currentColor" />
            </button>
          </div>
          <h2 className="text-2xl font-bold">{formData.displayName}</h2>
          <p className="text-brand text-sm font-mono uppercase tracking-widest mt-1">{formData.role.replace('-', ' ')}</p>
        </div>

        {/* Edit Form */}
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-mono uppercase tracking-widest mb-2 text-white/50">Full Name</label>
            <input
              type="text"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-mono uppercase tracking-widest mb-2 text-white/50">Bio</label>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors h-32 resize-none"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest mb-2 text-white/50">Status (Role)</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors appearance-none"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              >
                <option value="freshman" className="bg-dark">Freshman</option>
                <option value="upper-year" className="bg-dark">Upper-Year</option>
                <option value="employer" className="bg-dark">Employer</option>
              </select>
            </div>

            {(formData.role === 'upper-year' || formData.role === 'employer') && (
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-300">
                <div>
                  <h4 className="text-sm font-bold">Open to Mentoring?</h4>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">Show as a mentor to peers</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isMentor: !prev.isMentor }))}
                  className={cn(
                    "relative w-12 h-6 flex items-center rounded-full transition-all duration-300 outline-none",
                    formData.isMentor ? "bg-green-500" : "bg-white/10"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300",
                      formData.isMentor ? "translate-x-7" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            )}
          </div>

          <div className="pt-4">
            <button
              type="button"
              onClick={() => setIsAvailabilityOpen(!isAvailabilityOpen)}
              className={cn(
                "w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl transition-all hover:bg-white/10",
                isAvailabilityOpen && "rounded-b-none border-b-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand/10 rounded-lg text-brand">
                  <Calendar size={18} />
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-bold">Weekly Coffee Chat Availability</h4>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                    {Object.keys(formData.weeklyAvailability).length} Days Selected
                  </p>
                </div>
              </div>
              <ChevronDown 
                size={20} 
                className={cn("text-white/40 transition-transform duration-300", isAvailabilityOpen && "rotate-180")} 
              />
            </button>
            
            {isAvailabilityOpen && (
              <div className="p-4 bg-white/5 border-x border-b border-white/10 rounded-b-xl animate-in fade-in slide-in-from-top-4 duration-300">
                <AvailabilitySelector 
                  initialAvailability={formData.weeklyAvailability}
                  onChange={(val) => setFormData(prev => ({ ...prev, weeklyAvailability: val }))}
                  hideHeader
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest mb-2 text-white/50">Major / Field</label>
              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors"
                value={formData.major}
                onChange={(e) => setFormData({ ...formData, major: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-widest mb-2 text-white/50">Interests (comma separated)</label>
              <input
                type="text"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors"
                placeholder="SWE, AI, Hiking..."
                value={formData.interests}
                onChange={(e) => setFormData({ ...formData, interests: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className={cn(
              "flex items-center justify-center gap-2 py-3 rounded-xl border transition-all duration-300",
              saveStatus === 'saving' && "bg-white/5 border-white/10 text-white/50",
              saveStatus === 'saved' && "bg-brand/10 border-brand/30 text-brand",
              saveStatus === 'error' && "bg-red-500/10 border-red-500/30 text-red-500",
              saveStatus === 'idle' && "bg-white/5 border-white/5 text-white/20"
            )}>
              {saveStatus === 'saving' && (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Auto-saving...</span>
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Profile Saved</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertTriangle size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Save Failed - Check connection</span>
                </>
              )}
              {saveStatus === 'idle' && (
                <span className="text-[10px] font-bold uppercase tracking-widest">Profile current</span>
              )}
            </div>
            <p className="text-[9px] text-white/30 text-center uppercase tracking-tighter mb-6">Your changes are automatically saved as you type</p>

            <button
              onClick={() => navigate('/community')}
              className="w-full bg-brand text-dark py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-brand/90 transition-all uppercase tracking-widest text-sm shadow-lg shadow-brand/20"
            >
              <Coffee size={24} />
              Visit Matcha Board
            </button>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-4">
            <button
              onClick={seedTestMatch}
              disabled={seeding}
              className="w-full bg-blue-500/10 border border-blue-500/30 text-blue-400 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-500/20 transition-all uppercase tracking-widest text-xs"
            >
              <Beaker size={18} />
              {seeding ? 'Seeding...' : 'Seed Full Demo (Bots & Board)'}
            </button>

            {isAdmin && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertTriangle size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Admin Control Panel</span>
                </div>

                <button
                  onClick={seedCommunityBoard}
                  disabled={seeding}
                  className="w-full bg-brand/20 text-brand py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-brand/30 transition-all uppercase tracking-widest text-xs border border-brand/50"
                >
                  <Coffee size={18} />
                  {seeding ? 'Seeding...' : 'Seed Matcha Board'}
                </button>
                
                {!showConfirmReset ? (
                  <button
                    onClick={() => setShowConfirmReset(true)}
                    className="w-full bg-red-600/20 text-red-500 py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-600/30 transition-all uppercase tracking-widest text-xs border border-red-500/30"
                  >
                    <Trash2 size={18} />
                    Hard Reset (Delete All Matches)
                  </button>
                ) : (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <p className="text-[10px] text-red-500/80 italic text-center">
                      Are you absolutely sure? This will erase ALL connection history and messages system-wide.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowConfirmReset(false)}
                        className="flex-1 bg-white/5 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSystemReset}
                        disabled={resetting}
                        className="flex-2 bg-red-600 text-white py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-900/40"
                      >
                        {resetting ? 'Resetting...' : 'YES, DELETE EVERYTHING'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Extra Info */}
        <div className="glass p-4 flex items-start gap-3 bg-brand/5 border-brand/20">
          <Info size={20} className="text-brand shrink-0 mt-0.5" />
          <p className="text-xs text-brand/80 leading-relaxed">
            Your profile helps us match you with the right people. Be as specific as possible in your bio and interests for better mentorship and hiring opportunities.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {isCropping && imageToCrop && (
          <ImageCropperModal
            image={imageToCrop}
            onCropComplete={handleCropComplete}
            onClose={() => {
              setIsCropping(false);
              setImageToCrop(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
