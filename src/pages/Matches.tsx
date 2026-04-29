import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { dbService } from '../services/dbService';
import { Match, UserProfile, MatchStatus } from '../types';
import Loading from '../components/Loading';
import { MessageSquare, Search, GraduationCap, MapPin, Briefcase, Info, X, Sparkles, ChevronDown, Coffee } from 'lucide-react';
import { cn, safeDate } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { generateCoffeeChatRecommendation, generateIcebreaker } from '../services/geminiService';
import confetti from 'canvas-confetti';

import matchaIcon from '../lib/Matcha Latte Icon.png';

interface MatchWithProfile extends Match {
  profile: UserProfile;
}

interface MatchesProps {
  userProfile: UserProfile;
}

export default function Matches({ userProfile }: MatchesProps) {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchWithProfile[]>([]);
  const [likes, setLikes] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'messages' | 'likes'>('messages');
  const [loading, setLoading] = useState(true);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [matchedUser, setMatchedUser] = useState<UserProfile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

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
    if (!auth.currentUser) return;
    
    setLoading(true);
    const currentUid = auth.currentUser.uid;

    const fetchMatches = async () => {
      try {
        const matchesData: MatchWithProfile[] = [];
        const likesData: UserProfile[] = [];
        const profileCache: Record<string, UserProfile> = {};

        const allMatches = await dbService.getMatches(currentUid);
        const allUsers = await dbService.getUsers(currentUid);
        allUsers.forEach(u => profileCache[u.uid] = u);

        for (const m of allMatches) {
          const otherUserId = m.userIds.find(id => id !== currentUid);
          if (!otherUserId) continue;

          let profile = profileCache[otherUserId];
          if (!profile) {
            const fetched = await dbService.getUser(otherUserId);
            if (fetched) profile = fetched;
            else continue;
          }

          if (m.status === 'matched') {
            matchesData.push({ ...m, profile });

            // Notification Logic (Simplified for SQLite backend)
            if (!m.notifiedUsers?.includes(currentUid)) {
              if (!matchedUser) {
                setMatchId(m.id);
                setMatchedUser(profile);
                fireMatchConfetti();
                
                dbService.saveMatch({
                  ...m,
                  notifiedUsers: [...(m.notifiedUsers || []), currentUid]
                });
              }
            }
          } 
          else if (m.swipes && m.swipes[otherUserId] === 'liked' && !m.swipes[currentUid]) {
            likesData.push(profile);
          }
        }

        setMatches(matchesData.sort((a, b) => {
          const timeA = safeDate(a.updatedAt || a.createdAt).getTime();
          const timeB = safeDate(b.updatedAt || b.createdAt).getTime();
          return timeB - timeA;
        }));
        setLikes(likesData);
      } catch (err) {
        console.error("Matches Load Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
    const interval = setInterval(fetchMatches, 10000);
    return () => clearInterval(interval);
  }, [matchedUser]);

  const fireMatchConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 200,
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

  const handleAction = async (targetUser: UserProfile, direction: 'left' | 'right') => {
    if (!auth.currentUser) return;
    const currentUid = auth.currentUser.uid;

    const directionStatus = direction === 'right' ? 'liked' : 'passed';
    const computedMatchId = [currentUid, targetUser.uid].sort().join('_');
    const sortedUserIds = [currentUid, targetUser.uid].sort();
    
    try {
      const matchData = await dbService.getMatches(currentUid).then(ms => ms.find(m => m.id === computedMatchId));
      
      let finalStatus: MatchStatus = 'pending';
      const existingSwipes = matchData?.swipes || {};
      
      const newSwipes: { [uid: string]: 'liked' | 'passed' } = {
        ...existingSwipes,
        [currentUid]: directionStatus
      };

      if (direction === 'right') {
        const otherUserSwipe = existingSwipes[targetUser.uid];
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
        matchPayload.notifiedUsers = [currentUid];
        matchPayload.unreadCount = {
          [currentUid]: 0,
          [targetUser.uid]: 0
        };

        // Fire off AI recommendation
        generateCoffeeChatRecommendation(userProfile, targetUser).then(aiRec => {
          dbService.saveMatch({
            ...matchPayload,
            coffeeChat: { ...aiRec, generatedAt: new Date().toISOString() }
          });
        }).catch(aiErr => console.error("AI Recommendation failed:", aiErr));

        generateIcebreaker(userProfile, targetUser).then(icebreaker => {
           dbService.saveMatch({ ...matchPayload, icebreaker });
        }).catch(err => console.error("Icebreaker failed:", err));
      }

      await dbService.saveMatch(matchPayload);
      setShowDetails(false);
      
      if (finalStatus === 'matched') {
        setTimeout(() => {
          setMatchId(computedMatchId);
          setMatchedUser(targetUser);
          fireMatchConfetti();
        }, 100);
      }
    } catch (err) {
      console.error("Action error:", err);
    }
  };

  if (loading) return <Loading fullScreen />;

  return (
    <div className="flex-1 p-6 pb-32 max-w-4xl mx-auto w-full overflow-y-auto custom-scrollbar">
      <div className="flex flex-col mb-8">
        <h1 className="text-4xl font-display font-bold mb-6">Activity</h1>
        
        <div className="flex gap-4 border-b border-white/10">
          <button
            onClick={() => setActiveTab('messages')}
            className={cn(
              "pb-4 px-2 font-bold transition-all relative",
              activeTab === 'messages' ? "text-brand" : "text-white/40 hover:text-white"
            )}
          >
            Cheers!
            {activeTab === 'messages' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
            {matches.some(m => (m.unreadCount?.[auth.currentUser?.uid || ''] || 0) > 0) && (
              <span className="ml-2 bg-brand text-dark text-[10px] px-1.5 py-0.5 rounded-full">
                {matches.reduce((acc, m) => acc + (m.unreadCount?.[auth.currentUser?.uid || ''] || 0), 0)}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('likes')}
            className={cn(
              "pb-4 px-2 font-bold transition-all relative",
              activeTab === 'likes' ? "text-brand" : "text-white/40 hover:text-white"
            )}
          >
            Interested
            {activeTab === 'likes' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />}
            {likes.length > 0 && (
              <span className="ml-2 bg-brand text-dark text-[10px] px-1.5 py-0.5 rounded-full">
                {likes.length}
              </span>
            )}
          </button>
        </div>
      </div>
      
      {activeTab === 'messages' ? (
        matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 glass text-center">
            <MessageSquare size={48} className="text-white/20 mb-4" />
            <h3 className="text-xl font-bold mb-2">No Cheers! yet</h3>
            <p className="text-white/60 mb-6">Your professional connections will appear here after a mutual Cheers!.</p>
            <Link to="/discover" className="btn-primary">Browse Network</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {matches.map((match) => (
              <Link
                key={match.id}
                to={`/chat/${match.id}`}
                className="glass p-4 rounded-3xl flex items-center gap-4 hover:bg-white/5 transition-all group"
              >
                <div className="relative">
                  <img
                    src={match.profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(match.profile.displayName || 'P')}&background=random&size=256`}
                    alt={match.profile.displayName || 'Profile'}
                    className="w-16 h-16 rounded-full object-cover border-2 border-brand"
                  />
                  {(match.unreadCount?.[auth.currentUser?.uid || ''] || 0) > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand text-dark text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-dark" >
                      {match.unreadCount?.[auth.currentUser?.uid || '']}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="font-bold truncate text-lg">
                      {match.profile.displayName || 'Professional'}
                    </div>
                  </div>
                  <div className="text-sm text-white/50 truncate">
                    {match.lastMessage || 'No messages yet...'}
                  </div>
                </div>

                <div className="text-white/20 group-hover:text-brand transition-colors">
                  <MessageSquare size={20} />
                </div>
              </Link>
            ))}
          </div>
        )
      ) : (
        likes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 glass text-center">
            <Search size={48} className="text-white/20 mb-4" />
            <h3 className="text-xl font-bold mb-2">Nobody here yet</h3>
            <p className="text-white/60 mb-6">Keep your profile updated to attract more interest!</p>
            <Link to="/profile" className="btn-secondary">Professional Portfolio</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {likes.map((profile) => (
              <div
                key={profile.uid}
                className="glass rounded-3xl overflow-hidden flex flex-col group border border-white/5"
              >
                <div className="aspect-[2/3] relative">
                  <img
                    src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName)}&background=333&color=fff&size=512`}
                    alt={profile.displayName}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-dark to-transparent">
                    <div className="font-bold truncate text-sm">{profile.displayName || 'Professional'}</div>
                    <div className="text-[9px] text-brand uppercase font-bold tracking-wider">{profile.role?.replace('-', ' ') || 'Member'}</div>
                  </div>
                </div>
                <div 
                  className="bg-white/5 hover:bg-brand hover:text-dark transition-all text-[9px] font-bold uppercase tracking-widest py-3 text-center cursor-pointer"
                  onClick={() => {
                    setViewingProfile(profile);
                    setShowDetails(true);
                  }}
                >
                  Detail View
                </div>
              </div>
            ))}
          </div>
        )
      )}

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

                <div className="p-8">
                  <div className="flex items-center gap-2 mb-4">
                  <div className="bg-brand text-dark px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
                    {(viewingProfile.role || 'student').replace('-', ' ')}
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

                <div className="space-y-6 text-left">
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
                      onClick={() => handleAction(viewingProfile, 'left')}
                      className="flex-1 py-4 bg-white/5 hover:bg-red-500/10 text-red-500 rounded-2xl font-bold uppercase tracking-widest text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <X size={18} /> Pass
                    </button>
                    <button
                      onClick={() => handleAction(viewingProfile, 'right')}
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

      {/* Match Immersive Overlay */}
      <AnimatePresence>
        {matchedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-dark"
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
                  <img src={userProfile.avatarUrl || auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.displayName || auth.currentUser?.displayName || 'User')}&background=333&color=fff&size=512`} className="w-full h-full object-cover object-center" alt="Me" />
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
                  }}
                  className="py-4 text-white/60 hover:text-white transition-colors font-bold uppercase tracking-widest text-sm"
                >
                  Back to Activity
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
