import { useState, useEffect, useRef, FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { dbService } from '../services/dbService';
import { Message, UserProfile, Match } from '../types';
import { Send, ChevronLeft, Info, MessageSquare, Coffee, Calendar, Sparkles, Trash2, AlertCircle, X, Wand2 } from 'lucide-react';
import { cn } from '../lib/utils';
import Loading from '../components/Loading';
import { AnimatePresence, motion } from 'framer-motion';
import { generateIcebreaker } from '../services/geminiService';
import matchaIcon from '../lib/Matcha Latte Icon.png';

interface ChatProps {
  userProfile: UserProfile;
}

export default function Chat({ userProfile }: ChatProps) {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [matchData, setMatchData] = useState<Match | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [isUnmatching, setIsUnmatching] = useState(false);
  const [showIcebreakerPopup, setShowIcebreakerPopup] = useState(false);
  const [isGeneratingIcebreaker, setIsGeneratingIcebreaker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!matchId || !auth.currentUser) return;

    const fetchChatData = async () => {
      try {
        const m = await dbService.getMatches(auth.currentUser!.uid).then(ms => ms.find(x => x.id === matchId));
        if (!m) {
          navigate('/matches');
          return;
        }
        setMatchData(m);

        // Fetch other user profile
        const otherId = m.userIds.find(id => id !== auth.currentUser?.uid);
        if (otherId && !otherUser) {
          const user = await dbService.getUser(otherId);
          if (user) setOtherUser(user);
        }

        // Fetch messages
        const msgs = await dbService.getMessages(matchId);
        setMessages(msgs);
        setLoading(false);
      } catch (err) {
        console.error("Chat fetch error:", err);
        setLoading(false);
      }
    };

    fetchChatData();
    const interval = setInterval(fetchChatData, 5000); // Poll every 5s

    // Clear unread count when opening
    dbService.saveMatch({
      id: matchId,
      unreadCount: { ...matchData?.unreadCount, [auth.currentUser?.uid]: 0 }
    } as any);

    return () => clearInterval(interval);
  }, [matchId, otherUser]);

  const handleSendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !matchId || !auth.currentUser || !otherUser) return;

    const msg = inputText;
    const currentUid = auth.currentUser.uid;
    setInputText('');

    try {
      const messageId = Math.random().toString(36).substring(7);
      await dbService.sendMessage(matchId, {
        id: messageId,
        senderId: currentUid,
        text: msg,
      });

      // Update match record with last message info
      await dbService.saveMatch({
        id: matchId,
        lastMessage: msg,
        updatedAt: new Date().toISOString(),
        unreadCount: {
          ...matchData?.unreadCount,
          [otherUser.uid]: (matchData?.unreadCount?.[otherUser.uid] || 0) + 1
        }
      } as any);

      // Trigger scroll
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleUnmatch = async () => {
    if (!matchId || !auth.currentUser) return;
    setIsUnmatching(true);
    try {
      await dbService.saveMatch({
        id: matchId,
        status: 'unmatched',
        updatedAt: new Date().toISOString(),
        unmatchedBy: auth.currentUser.uid,
        unmatchedAt: new Date().toISOString()
      } as any);
      navigate('/matches');
    } catch (err) {
      console.error("Unmatch error:", err);
      alert("Failed to unmatch. Please try again.");
    } finally {
      setIsUnmatching(false);
      setShowUnmatchConfirm(false);
    }
  };

  if (loading && messages.length === 0) return <Loading fullScreen />;

  return (
    <div className="flex-1 flex flex-col bg-dark overflow-hidden h-full">
      {/* Header */}
      <header className="p-4 border-b border-white/10 glass flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60">
            <ChevronLeft size={24} />
          </button>
          
          {otherUser && (
            <div className="flex items-center gap-3">
              <img
                src={otherUser.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser.displayName)}&background=random`}
                alt={otherUser.displayName}
                className="w-10 h-10 rounded-full object-cover border border-brand"
              />
              <div>
                <div className="font-bold text-sm">{otherUser.displayName}</div>
                <div className="text-[10px] text-brand uppercase tracking-widest font-bold">
                  {otherUser.role.replace('-', ' ')}
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowIcebreakerPopup(true)}
            className="p-2 hover:bg-brand/10 rounded-full text-brand transition-colors"
            title="AI Icebreaker"
          >
            <Wand2 size={20} />
          </button>
          <Link to="/discover" className="p-2 hover:bg-white/10 rounded-full text-white/40">
            <Info size={20} />
          </Link>
          <button 
            onClick={() => setShowUnmatchConfirm(true)}
            className="p-2 hover:bg-red-500/10 rounded-full text-red-500/60 transition-colors"
            title="Unmatch"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      {/* Icebreaker Popup Modal */}
      <AnimatePresence>
        {showIcebreakerPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-dark/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-dark/80 border border-brand/20 p-6 md:p-8 rounded-[2.5rem] max-w-md w-full relative shadow-[0_0_50px_rgba(0,255,111,0.1)]"
            >
              <button 
                onClick={() => setShowIcebreakerPopup(false)}
                className="absolute top-6 right-6 p-2 hover:bg-white/5 rounded-full text-white/40"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-brand/10 flex items-center justify-center">
                  <img src={matchaIcon} className="w-6 h-6 object-contain" alt="Matcha" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold">AI Icebreaker</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Powered by Gemini</p>
                </div>
              </div>

              {matchData?.icebreaker ? (
                <div className="space-y-6">
                  <p className="text-white/80 italic leading-relaxed text-lg font-medium">
                    "{matchData.icebreaker}"
                  </p>
                  <button
                    onClick={() => {
                      setInputText(matchData.icebreaker!);
                      setShowIcebreakerPopup(false);
                    }}
                    className="w-full py-4 bg-brand text-dark rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] shadow-[0_0_20px_rgba(0,255,111,0.3)] hover:scale-[1.02] transition-transform active:scale-95"
                  >
                    Use This Suggestion
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-white/60 text-sm mb-6">Need a hand starting the conversation? Let AI generate an icebreaker based on your shared interests.</p>
                  <button
                    onClick={async () => {
                      if (!otherUser || isGeneratingIcebreaker) return;
                      setIsGeneratingIcebreaker(true);
                      try {
                        const ice = await generateIcebreaker(userProfile, otherUser);
                        await dbService.saveMatch({
                          id: matchId!,
                          icebreaker: ice
                        } as any);
                        setMatchData(prev => prev ? { ...prev, icebreaker: ice } : null);
                      } catch (err) {
                        console.error("Gen error:", err);
                      } finally {
                        setIsGeneratingIcebreaker(false);
                      }
                    }}
                    disabled={isGeneratingIcebreaker}
                    className="w-full py-4 bg-white/5 border border-brand/20 text-brand rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] disabled:opacity-50"
                  >
                    {isGeneratingIcebreaker ? "Generating..." : "Generate Icebreaker"}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unmatch Confirmation Modal */}
      <AnimatePresence>
        {showUnmatchConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-dark/95 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-dark border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl"
            >
              <div className="bg-red-500/10 text-red-500 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-display font-bold mb-3">End Connection?</h3>
              <p className="text-white/60 text-sm mb-8">
                This will remove {otherUser?.displayName} from your Professional Connections. They won't be able to message you anymore.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleUnmatch}
                  disabled={isUnmatching}
                  className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
                >
                  {isUnmatching ? "Removing..." : "Yes, End Connection"}
                </button>
                <button
                  onClick={() => setShowUnmatchConfirm(false)}
                  disabled={isUnmatching}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/80 rounded-2xl font-bold uppercase tracking-widest text-xs transition-colors"
                >
                  Never mind
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pt-6 scroll-smooth custom-scrollbar">
        {matchData?.coffeeChat && (
          <div className="glass p-4 mb-6 border-brand/20 bg-brand/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-30 transition-opacity">
              <img src={matchaIcon} className="w-20 h-20 object-contain" alt="Matcha" />
            </div>
            <div className="flex items-center gap-2 text-brand mb-2">
              <img src={matchaIcon} className="w-4 h-4 object-contain" alt="Matcha" />
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">AI Matcha Chat Suggestion</h4>
            </div>
            <p className="text-xs text-white/80 leading-relaxed mb-3">
              {matchData.coffeeChat.recommendation}
            </p>
            <div className="flex items-center gap-2 bg-dark/40 p-2 rounded-lg border border-white/5">
              <Calendar size={14} className="text-brand" />
              <div className="text-[10px] font-mono text-white/60">
                Suggested Time: <span className="text-brand font-bold">{matchData.coffeeChat.suggestedTime}</span>
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
            <div className="bg-brand/10 p-4 rounded-full mb-4 animate-pulse">
              <MessageSquareConnection size={48} />
            </div>
            <h3 className="text-xl font-display font-bold mb-2">You've got a Cheers!</h3>
            <p className="text-sm text-white/40 mb-8 max-w-[240px]">Send a message to start the conversation and build your network.</p>

            {matchData?.icebreaker ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="glass p-6 border-brand/30 bg-brand/5 relative overflow-hidden group max-w-sm w-full cursor-pointer hover:bg-brand/10 transition-all shadow-[0_0_30px_rgba(0,255,111,0.05)]"
                onClick={() => {
                  setInputText(matchData.icebreaker!);
                  inputRef.current?.focus();
                }}
              >
                <div className="absolute -top-4 -right-4 p-2 opacity-10 scale-[2] rotate-12 transition-transform group-hover:rotate-45">
                  <img src={matchaIcon} className="w-20 h-20 object-contain" alt="Matcha" />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-brand">
                    <img src={matchaIcon} className="w-4 h-4 object-contain" alt="Matcha" />
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">AI Matcha Starter</h4>
                  </div>
                  <div className="text-[10px] font-bold text-brand uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                    Select
                  </div>
                </div>
                <p className="text-base text-white/90 italic font-medium leading-relaxed mb-6">
                  "{matchData.icebreaker}"
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInputText(matchData.icebreaker!);
                    inputRef.current?.focus();
                  }}
                  className="w-full py-3 bg-brand text-dark rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
                >
                  <Send size={12} /> Use This Starter
                </button>
              </motion.div>
            ) : (
              <button
                onClick={async () => {
                  if (!otherUser || isGeneratingIcebreaker) return;
                  setIsGeneratingIcebreaker(true);
                  try {
                    const ice = await generateIcebreaker(userProfile, otherUser);
                    await dbService.saveMatch({
                      id: matchId!,
                      icebreaker: ice
                    } as any);
                  } catch (err) {
                    console.error("Gen error:", err);
                  } finally {
                    setIsGeneratingIcebreaker(false);
                  }
                }}
                disabled={isGeneratingIcebreaker}
                className="glass px-8 py-4 border-brand/20 bg-brand/5 text-brand rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-3 hover:bg-brand/10 transition-colors disabled:opacity-50"
              >
                {isGeneratingIcebreaker ? (
                  <>
                    <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    Crafting...
                  </>
                ) : (
                  <>
                    <Wand2 size={16} />
                    Get AI Icebreaker
                  </>
                )}
              </button>
            )}
          </div>
        )}
        
        {messages.map((msg) => {
          const isMe = msg.senderId === auth.currentUser?.uid;
          return (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[80%]",
                isMe ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div
                className={cn(
                  "p-3 rounded-2xl text-sm",
                  isMe 
                    ? "bg-brand text-dark rounded-tr-none font-medium" 
                    : "bg-white/10 text-white rounded-tl-none border border-white/10"
                )}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="p-4 bg-dark/50 backdrop-blur-md border-t border-white/10 shrink-0 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-6"
      >
        <div className="flex gap-2 max-w-4xl mx-auto items-center">
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-6 py-3 focus:outline-none focus:border-brand transition-colors text-base"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-12 h-12 flex items-center justify-center bg-brand text-dark rounded-full hover:scale-105 transition-transform active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            <Send size={20} />
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageSquareConnection({ size = 24 }: { size?: number }) {
  return (
    <div className="relative">
      <MessageSquare size={size} />
      <div className="absolute -top-1 -right-1 bg-brand rounded-full w-2 h-2" />
    </div>
  );
}
