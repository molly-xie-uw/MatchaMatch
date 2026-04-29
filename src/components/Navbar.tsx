import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, MessageCircle, User as UserIcon, Coffee } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { dbService } from '../services/dbService';

export default function Navbar() {
  const location = useLocation();
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchUnreadTotal = async () => {
      try {
        const matches = await dbService.getMatches(auth.currentUser!.uid);
        let count = 0;
        matches.forEach(data => {
          if (data.status === 'matched' && data.unreadCount) {
            count += data.unreadCount[auth.currentUser?.uid || ''] || 0;
          }
          // Also count new likes (pending)
          const otherUserId = data.userIds.find((id: string) => id !== auth.currentUser?.uid);
          if (otherUserId && data.status !== 'matched' && data.swipes && data.swipes[otherUserId] === 'liked' && !data.swipes[auth.currentUser?.uid || '']) {
            count += 1;
          }
        });
        setUnreadTotal(count);
      } catch (err) {
        console.error("Navbar unread error:", err);
      }
    };

    fetchUnreadTotal();
    const interval = setInterval(fetchUnreadTotal, 10000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: '/discover', icon: Compass, label: 'Discover' },
    { path: '/community', icon: Coffee, label: 'Matcha Board' },
    { path: '/matches', icon: MessageCircle, label: 'Matches', badge: unreadTotal },
    { path: '/profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-6 left-6 right-6 z-40 md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto">
      <div className="max-w-md mx-auto md:max-w-7xl">
        <div className="bg-dark/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] px-6 py-3 shadow-2xl md:bg-transparent md:backdrop-blur-none md:border-none md:rounded-none md:p-0 md:shadow-none flex justify-between items-center">
          <Link to="/" className="hidden md:flex items-center gap-3 font-display font-bold text-2xl text-brand group shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-brand/20 blur-md rounded-full group-hover:bg-brand/40 transition-colors" />
              <div className="relative bg-white/5 border border-white/10 p-0 rounded-xl group-hover:scale-110 transition-transform shadow-lg shadow-black/20 overflow-hidden">
                <img 
                  src="/logo.svg" 
                  alt="Logo" 
                  className="w-10 h-10 object-contain" 
                />
              </div>
            </div>
            MatchaMatch
          </Link>
          
          <div className="flex flex-1 justify-around md:justify-end md:gap-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                     "flex flex-col items-center gap-1 transition-all duration-300 relative group py-1",
                    isActive ? "text-brand scale-110" : "text-white/60 hover:text-white"
                  )}
                >
                  <div className="relative">
                    <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                    {item.label === 'Matches' ? (
                      <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-dark text-[10px] font-bold ring-2 ring-dark shadow-lg shadow-brand/20">
                        {item.badge || 0}
                      </span>
                    ) : (
                      item.badge && item.badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-dark text-[8px] font-bold ring-2 ring-dark animate-pulse">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )
                    )}
                  </div>
                  <span className={cn(
                    "text-[8px] font-black uppercase tracking-tighter sm:tracking-wider md:block",
                    isActive ? "text-brand" : "text-white/40"
                  )}>
                    {item.label === 'Matcha Board' ? 'Board' : item.label}
                  </span>
                  
                  {isActive && (
                    <motion.div 
                      layoutId="nav-active"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-brand rounded-full hidden md:block"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
