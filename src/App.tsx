import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { AnimatePresence, motion } from 'framer-motion';
import { auth } from './lib/firebase';
import { dbService } from './services/dbService';
import { UserProfile } from './types';
import { cn } from './lib/utils';

// Pages
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Discover from './pages/Discover';
import Matches from './pages/Matches';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Community from './pages/Community';

// Components
import Navbar from './components/Navbar';
import Loading from './components/Loading';

function AppContent({ 
  user, 
  profile, 
  setProfile 
}: { 
  user: User | null, 
  profile: UserProfile | null, 
  setProfile: (p: UserProfile | null) => void 
}) {
  const location = useLocation();
  const isChatPage = /^\/chat\//.test(location.pathname);

  return (
    <div className="h-[100dvh] flex flex-col bg-dark overflow-hidden selection:bg-brand/30">
      <main className="flex-1 flex flex-col relative overflow-hidden order-1 md:order-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={!user ? <Landing /> : (profile ? <Navigate to="/discover" /> : <Navigate to="/onboarding" />)} />
              
              {/* Protected Routes */}
              <Route path="/onboarding" element={user && !profile ? <Onboarding onComplete={(p) => setProfile(p)} /> : <Navigate to="/" />} />
              <Route path="/discover" element={user && profile ? <Discover userProfile={profile} /> : <Navigate to="/" />} />
              <Route path="/matches" element={user && profile ? <Matches userProfile={profile} /> : <Navigate to="/" />} />
              <Route path="/community" element={user && profile ? <Community userProfile={profile} /> : <Navigate to="/" />} />
              <Route path="/chat/:matchId" element={user && profile ? <Chat userProfile={profile} /> : <Navigate to="/" />} />
              <Route path="/profile" element={user && profile ? <Profile profile={profile} onUpdate={(p) => setProfile(p)} /> : <Navigate to="/" />} />
              
              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      {user && profile && !isChatPage && (
        <div className="order-2 md:order-1">
          <Navbar />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          const fetchedProfile = await dbService.getUser(firebaseUser.uid);
          if (fetchedProfile) {
            setProfile(fetchedProfile);
          } else {
            setProfile(null);
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <Loading fullScreen />;
  }

  return (
    <BrowserRouter>
      <AppContent user={user} profile={profile} setProfile={setProfile} />
    </BrowserRouter>
  );
}
