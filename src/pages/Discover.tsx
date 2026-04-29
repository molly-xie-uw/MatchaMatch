import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { UserProfile, MatchStatus, Match } from '../types';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { cn } from '../lib/utils';
import { X, Sparkles, MapPin, Briefcase, GraduationCap, MessageSquare, Send, Calendar, ChevronDown, Filter, Info, Coffee } from 'lucide-react';
import Loading from '../components/Loading';
import confetti from 'canvas-confetti';
import { generateCoffeeChatRecommendation, generateIcebreaker } from '../services/geminiService';

import matchaIcon from '../lib/Matcha Latte Icon.png';

interface DiscoverProps {
  userProfile: UserProfile;
}

export default function Discover({ userProfile }: DiscoverProps) {
  const navigate = useNavigate();
  const [potentialMatches, setPotentialMatches] = useState<UserProfile[]>([]);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<'liked' | 'passed' | null>(null);
  const [matchedUser, setMatchedUser] = useState<UserProfile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (showDetails) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showDetails]);

  useEffect(() => {
    fetchPotentialMatches();
  }, []);

  const fetchPotentialMatches = async () => {
    setLoading(true);
    try {
      // 1. Fetch matches involving current user to filter them out
      const matches = await dbService.getMatches(userProfile.uid);
      
      const excludedUserIds = new Set<string>();
      matches.forEach(data => {
        const otherId = data.userIds.find((id: string) => id !== userProfile.uid);
        if (otherId) {
          // Exclude if already matched OR if the CURRENT user has already swiped
          if (data.status === 'matched' || (data.swipes && data.swipes[userProfile.uid])) {
            excludedUserIds.add(otherId);
          }
        }
      });

      // 2. Fetch all users
      const users = await dbService.getUsers(userProfile.uid);
      
      // 3. Filter out already-swiped and apply role logic
      const filtered = users.filter((u: UserProfile) => {
        // Only exclude if already matched or swiped
        if (excludedUserIds.has(u.uid)) return false;

        // Ensure users have a display name to be discoverable
        if (!u.displayName) return false;

        return true;
      }).sort(() => Math.random() - 0.5);

      setPotentialMatches(filtered);
      setCurrentIndex(0);
    } catch (err) {
      console.error("Discovery error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fireMatchConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 100,
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    // Correctly identify the user being swiped from the filtered list
    const currentFilteredMatches = potentialMatches.filter(u => {
      if (filterRole === 'all') return true;
      return u.role === filterRole;
    });
    
    const targetUser = currentFilteredMatches[currentIndex];
    if (!targetUser) return;

    setFeedback(direction === 'right' ? 'liked' : 'passed');
    
    // Status update in DB
    const directionStatus = direction === 'right' ? 'liked' : 'passed';
    const computedMatchId = [userProfile.uid, targetUser.uid].sort().join('_');
    const sortedUserIds = [userProfile.uid, targetUser.uid].sort();
    
    try {
      const matchData = await dbService.getMatches(userProfile.uid).then(matches => matches.find(m => m.id === computedMatchId));
      
      let finalStatus: MatchStatus = 'pending';
      const existingSwipes = matchData?.swipes || {};
      
      // Update our swipe
      const newSwipes: { [uid: string]: 'liked' | 'passed' } = {
        ...existingSwipes,
        [userProfile.uid]: directionStatus
      };

      // Check for match
      if (direction === 'right') {
        const otherUserSwipe = existingSwipes[targetUser.uid];
        // Check if the other user liked us OR if it's already a match in the DB
        if (otherUserSwipe === 'liked' || matchData?.status === 'matched') {
          finalStatus = 'matched';
        } else {
          finalStatus = 'liked'; 
        }
      } else {
        finalStatus = directionStatus; 
      }

      const matchPayload: Match = {
        id: computedMatchId,
        userIds: sortedUserIds,
        swipes: newSwipes,
        status: finalStatus,
        createdAt: matchData?.createdAt || new Date().toISOString()
      };

      if (finalStatus === 'matched' && (!matchData?.unreadCount || Object.keys(matchData.unreadCount).length === 0)) {
        matchPayload.notifiedUsers = [userProfile.uid];
        matchPayload.unreadCount = {
          [userProfile.uid]: 0,
          [targetUser.uid]: 0
        };

        // Fire off AI recommendation
        generateCoffeeChatRecommendation(userProfile, targetUser).then(aiRec => {
          dbService.saveMatch({
            ...matchPayload,
            coffeeChat: {
              ...aiRec,
              generatedAt: new Date().toISOString()
            }
          });
        }).catch(aiErr => console.error("AI Recommendation failed:", aiErr));

        generateIcebreaker(userProfile, targetUser).then(icebreaker => {
          dbService.saveMatch({
            ...matchPayload,
            icebreaker
          });
        }).catch(err => console.error("Icebreaker failed:", err));
      }

      await dbService.saveMatch(matchPayload);
      
      if (finalStatus === 'matched') {
        // Success state for match
        setTimeout(() => {
          setMatchId(computedMatchId);
          setMatchedUser(targetUser);
          fireMatchConfetti();
        }, 100);
      } else {
        // Just move to next card
        setTimeout(() => {
          setFeedback(null);
          setCurrentIndex((prev: number) => prev + 1);
        }, 200);
      }
    } catch (err) {
      console.error("Match error:", err);
      setTimeout(() => {
        setFeedback(null);
        setCurrentIndex((prev: number) => prev + 1);
      }, 300);
    }
  };

  const currentFilteredMatches = potentialMatches.filter(u => {
    if (filterRole === 'all') return true;
    return u.role === filterRole;
  });
  const currentCard = currentFilteredMatches[currentIndex];

  if (loading) return <Loading fullScreen />;

  const roles = [
    { id: 'all', label: 'All' },
    { id: 'freshman', label: 'Freshmen' },
    { id: 'upper-year', label: 'Upper-Year' },
    { id: 'employer', label: 'Employers' },
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 pb-32 relative overflow-hidden">
      {/* Compact Filter Dropdown in Corner */}
      <div className="absolute top-4 right-4 z-40">
        <div className="relative group">
          <select
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value);
              setCurrentIndex(0);
            }}
            className="bg-white/5 border border-white/10 text-white py-2 pl-4 pr-10 rounded-full text-[10px] font-bold uppercase tracking-widest appearance-none focus:outline-none focus:ring-1 focus:ring-brand/30 transition-all cursor-pointer backdrop-blur-md hover:bg-white/10"
          >
            {roles.map(role => (
              <option key={role.id} value={role.id} className="bg-dark text-white">
                {role.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-brand">
            <ChevronDown size={14} />
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-sm flex-1 flex flex-col min-h-0 max-h-[75vh] md:aspect-[3/4.5]">
        <AnimatePresence mode="popLayout">
          {currentCard ? (
            <SwipeCard
              key={currentCard.uid}
              user={currentCard}
              onSwipe={handleSwipe}
              feedback={feedback}
              onViewProfile={() => {
                setViewingProfile(currentCard);
                setShowDetails(true);
              }}
            />
          ) : !loading && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-full text-center p-8 glass"
            >
              <div className="bg-brand/10 p-4 rounded-full mb-6">
                <img src={matchaIcon} className="w-16 h-16 object-contain" alt="Matcha" />
              </div>
              <h2 className="text-2xl font-display font-bold mb-2 uppercase">The Whisk is Empty</h2>
              <p className="text-white/40 text-[10px] mb-8 max-w-xs uppercase tracking-widest font-bold leading-relaxed">
                You've sipped through all available connections in this category. Stir up a new search or brew some more time for new faces!
              </p>
              <div className="flex flex-col gap-2 w-full">
                <button 
                  onClick={() => { setFilterRole('all'); setCurrentIndex(0); fetchPotentialMatches(); }} 
                  className="btn-secondary text-[10px] py-3 px-8 w-full"
                >
                  Reset Discovery
                </button>
                <button 
                  onClick={() => navigate('/community')} 
                  className="bg-brand/10 text-brand py-3 px-8 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand/20 transition-all border border-brand/30"
                >
                  Visit Matcha Board
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex gap-6 mt-8">
        <button
          onClick={() => handleSwipe('left')}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-red-500 hover:bg-white/10 transition-all hover:scale-110 active:scale-95 disabled:opacity-20"
          disabled={!!matchedUser || !currentCard}
        >
          <X size={32} />
        </button>
        <button
          onClick={() => handleSwipe('right')}
          className="w-16 h-16 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-brand hover:bg-white/10 transition-all hover:scale-110 active:scale-95 disabled:opacity-20"
          disabled={!!matchedUser || !currentCard}
        >
          <img src={matchaIcon} className="w-8 h-8 object-contain" alt="Matcha" />
        </button>
      </div>

      {/* Match Immersive Overlay */}
      <AnimatePresence>
        {matchedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-dark"
          >
            {/* Background animated elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1],
                  rotate: [0, 90, 180, 270, 360]
                }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-1/2 -left-1/2 w-full h-full bg-brand/10 blur-[120px] rounded-full"
              />
              <motion.div
                animate={{ 
                  scale: [1.2, 1, 1.2],
                  opacity: [0.1, 0.3, 0.1],
                  rotate: [360, 270, 180, 90, 0]
                }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-brand/10 blur-[120px] rounded-full"
              />
            </div>

            <div className="relative z-10 w-full max-w-lg px-6 flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
                className="mb-8"
              >
                <div className="text-brand flex items-center justify-center mb-4 gap-4">
                  <img src={matchaIcon} className="w-12 h-12 object-contain" alt="Matcha" />
                  <span className="text-xs font-bold uppercase tracking-[0.4em] whitespace-nowrap">Cheers! It's Matcha</span>
                  <img src={matchaIcon} className="w-12 h-12 object-contain" alt="Matcha" />
                </div>
                <h2 className="text-6xl md:text-7xl font-display font-black text-white leading-tight uppercase text-balance">
                  CHEERS!<br /><span className="text-brand">IT'S MATCHA!</span>
                </h2>
              </motion.div>
              
              <div className="flex items-center justify-center gap-4 mb-12 relative h-40 w-full">
                <motion.div
                  initial={{ x: -100, opacity: 0, rotate: -10 }}
                  animate={{ x: 20, opacity: 1, rotate: -5 }}
                  transition={{ delay: 0.5, duration: 0.6, type: "spring" }}
                  className="w-32 h-44 rounded-3xl overflow-hidden border-2 border-white shadow-2xl z-20 bg-dark"
                >
                  <img src={userProfile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.displayName || 'Me')}&background=333&color=fff&size=512`} className="w-full h-full object-cover object-center" alt="Me" />
                </motion.div>
                
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 1, type: "spring", stiffness: 400 }}
                  className="z-30 bg-brand text-dark p-4 rounded-full shadow-lg absolute"
                >
                  <img src={matchaIcon} className="w-8 h-8 object-contain" alt="Matcha" />
                </motion.div>

                <motion.div
                  initial={{ x: 100, opacity: 0, rotate: 10 }}
                  animate={{ x: -20, opacity: 1, rotate: 5 }}
                  transition={{ delay: 0.5, duration: 0.6, type: "spring" }}
                  className="w-32 h-44 rounded-3xl overflow-hidden border-2 border-white shadow-2xl z-20 bg-dark"
                >
                  <img src={matchedUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(matchedUser.displayName)}&background=333&color=fff&size=512`} className="w-full h-full object-cover object-center" alt="Match" />
                </motion.div>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="text-xl text-white/80 mb-12 font-medium"
              >
                You and {matchedUser.displayName} connected.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.4 }}
                className="flex flex-col gap-4 w-full"
              >
                <button
                  onClick={() => navigate(`/chat/${matchId}`)}
                  className="btn-primary py-4 text-lg w-full flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(0,255,111,0.3)]"
                >
                  <MessageSquare size={24} />
                  Send a Message
                </button>
                <button
                  onClick={() => {
                    setMatchedUser(null);
                    setMatchId(null);
                    setFeedback(null);
                    setCurrentIndex((prev) => prev + 1);
                  }}
                  className="py-4 text-white/60 hover:text-white transition-colors font-bold uppercase tracking-widest text-sm"
                >
                  Keep Discovering
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Detail Modal */}
      <AnimatePresence>
        {showDetails && viewingProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center p-0 sm:p-4 bg-dark/95 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-dark border-t sm:border border-white/10 w-full max-w-lg h-[92vh] sm:h-auto sm:max-h-[85vh] rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col shadow-2xl shadow-brand/10 relative"
            >
              <button
                onClick={() => setShowDetails(false)}
                className="absolute top-6 right-6 z-[130] bg-dark/50 backdrop-blur-md text-white p-2 rounded-full hover:bg-dark/80 transition-colors shadow-xl"
              >
                <X size={24} />
              </button>

              <div className="overflow-y-auto custom-scrollbar flex-1 overscroll-contain">
                <div className="relative aspect-[4/5] sm:aspect-video shrink-0">
                  <img
                    src={viewingProfile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(viewingProfile.displayName)}&background=333&color=fff&size=800`}
                    alt={viewingProfile.displayName}
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-dark via-transparent to-transparent opacity-60" />
                </div>

                <div className="p-8 pb-32">
                  <div className="flex items-center gap-2 mb-4">
                  <div className="bg-brand text-dark px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {(viewingProfile.role || 'Professional').replace('-', ' ')}
                  </div>
                  {viewingProfile.isMentor && (
                    <div className="bg-green-500 text-dark px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <Sparkles size={10} /> Mentor
                    </div>
                  )}
                </div>

                <h3 className="text-3xl font-display font-bold mb-1 truncate">{viewingProfile.displayName || 'Professional'}</h3>
                
                <div className="flex flex-col gap-3 text-white/80 mb-8">
                  {viewingProfile.role === 'employer' ? (
                    <div className="flex items-center gap-2 truncate">
                      <Briefcase size={18} className="text-brand shrink-0" /> 
                      <span className="truncate">{viewingProfile.companyName || 'Confidential Company'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 truncate">
                      <GraduationCap size={18} className="text-brand shrink-0" /> 
                      <span className="truncate">{viewingProfile.major || 'Interdisciplinary Studies'}</span>
                    </div>
                  )}
                  {viewingProfile.location && (
                    <div className="flex items-center gap-2 text-white/50 truncate">
                      <MapPin size={16} className="shrink-0" /> 
                      <span className="truncate">{viewingProfile.location}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand mb-2">About</h4>
                    <p className="text-white/70 leading-relaxed italic">
                      "{viewingProfile.bio || 'Networking for meaningful growth and professional connections.'}"
                    </p>
                  </div>

                  {viewingProfile.interests && viewingProfile.interests.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-brand mb-3">Professional Interests</h4>
                      <div className="flex flex-wrap gap-2">
                        {viewingProfile.interests.map(interest => (
                          <span key={interest} className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-xs text-white/80">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-8 flex gap-4">
                    <button
                      onClick={() => {
                        setShowDetails(false);
                        handleSwipe('left');
                      }}
                      className="flex-1 py-4 bg-white/5 hover:bg-red-500/10 text-red-500 rounded-2xl font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <X size={18} /> Pass
                    </button>
                    <button
                      onClick={() => {
                        setShowDetails(false);
                        handleSwipe('right');
                      }}
                      className="flex-[2] py-4 bg-brand hover:bg-brand/80 text-dark rounded-2xl font-bold uppercase tracking-widest text-xs transition-colors shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
                    >
                      <img src={matchaIcon} className="w-5 h-5 object-contain" alt="Matcha" /> Cheers!
                    </button>
                  </div>
                </div>

                <div className="flex justify-center mt-8 text-white/20 animate-bounce">
                  <ChevronDown size={20} />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SwipeCard({ user, onSwipe, feedback, onViewProfile }: { user: UserProfile, onSwipe: (dir: 'left' | 'right') => void, feedback: 'liked' | 'passed' | null, onViewProfile: () => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) onSwipe('right');
        else if (info.offset.x < -100) onSwipe('left');
      }}
      style={{ x, rotate, opacity }}
      className="swipe-card glass rounded-[2.5rem] overflow-hidden flex flex-col h-full shadow-2xl relative cursor-grab active:cursor-grabbing border border-white/10"
    >
      <div className="flex-1 relative cursor-pointer" onClick={(e) => {
        // Only trigger if not dragging significantly
        // Increased threshold to 15 to handle natural finger movement on mobile
        if (Math.abs(x.get()) < 15) {
          onViewProfile();
        }
      }}>
        <img
          src={user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName)}&background=00FF00&color=0A0A0A&size=512`}
          alt={user.displayName}
          className="w-full h-full object-cover object-center transition-opacity duration-500"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark via-transparent to-transparent opacity-80" />
        
        <div className="absolute top-4 right-4 z-[20]">
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onViewProfile();
            }}
            className="bg-brand text-dark p-3 rounded-full hover:bg-brand/80 transition-all hover:scale-110 active:scale-90 shadow-2xl flex items-center justify-center cursor-pointer"
            title="View Details"
          >
            <Info size={24} strokeWidth={2.5} />
          </button>
        </div>
        
        <div className="absolute top-4 left-4 flex gap-2 pointer-events-none">
          <div className="bg-brand text-dark px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
            {(user.role || 'student').replace('-', ' ')}
          </div>
          {user.isMentor && (
            <div className="bg-green-500 text-dark px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
              <Sparkles size={10} /> Mentor
            </div>
          )}
        </div>
        
        {/* Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
          <h3 className="text-3xl font-display font-bold mb-1 truncate pr-12">{user.displayName || 'Professional'}</h3>
          
          <div className="flex items-center gap-2 text-white/80 text-sm mb-3">
            {user.role === 'employer' ? (
              <div className="flex items-center gap-1 truncate"><Briefcase size={14} className="shrink-0" /> <span className="truncate">{user.companyName || 'Employer'}</span></div>
            ) : (
              <div className="flex items-center gap-1 truncate"><GraduationCap size={14} className="shrink-0" /> <span className="truncate">{user.major || 'Networking'}</span></div>
            )}
          </div>

          <p className="text-white/60 text-sm line-clamp-3 mb-4 leading-relaxed">
            "{user.bio || 'Networking for meaningful growth and professional connections.'}"
          </p>
          
          <div className="flex flex-wrap gap-2">
            {user.interests?.slice(0, 3).map(interest => (
              <span key={interest} className="text-[10px] bg-white/10 px-2 py-1 rounded-md text-white/70">
                #{interest}
              </span>
            ))}
          </div>
        </div>
      </div>

      {feedback && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`absolute inset-0 flex items-center justify-center z-50 pointer-events-none backdrop-blur-[2px] ${feedback === 'liked' ? 'bg-brand/20' : 'bg-red-500/20'}`}
        >
          <div className={`p-8 rounded-full border-4 flex items-center justify-center ${feedback === 'liked' ? 'border-brand text-brand' : 'border-red-500 text-red-500'}`}>
            {feedback === 'liked' ? <img src={matchaIcon} className="w-16 h-16 object-contain" alt="Matcha" /> : <X size={64} />}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
