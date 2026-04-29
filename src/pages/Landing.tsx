import { motion } from 'framer-motion';
import { signInWithGoogle } from '../lib/firebase';
import { LogIn, Leaf, Users, GraduationCap } from 'lucide-react';

export default function Landing() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-dark relative overflow-y-auto custom-scrollbar">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 opacity-20">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-brand rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-blue-500 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="max-w-2xl"
      >
        <div className="flex items-center justify-center mb-8">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-brand/30 blur-3xl rounded-full scale-150 animate-pulse" />
            <div className="relative bg-white/5 border border-white/10 p-0 rounded-[40px] shadow-2xl backdrop-blur-sm overflow-hidden flex items-center justify-center">
              <img 
                src="/logo.svg" 
                alt="MatchaMatch Logo" 
                className="w-32 h-32 md:w-40 md:h-40 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(132,204,22,0.8)]" 
              />
            </div>
          </motion.div>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-display font-bold mb-6 tracking-tight">
          Find your <span className="text-brand text-glow shadow-brand/50">network</span> before you need it.
        </h1>
        
        <p className="text-lg md:text-xl text-white/60 mb-12 max-w-lg mx-auto leading-relaxed">
          The ultimate blend for student networking. Connect with mentors, peers, and startups tailored to your journey.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 text-left">
          <div className="glass p-5">
            <Users className="text-brand mb-3" size={24} />
            <h3 className="font-bold mb-1">Peer Matching</h3>
            <p className="text-sm text-white/60 text-pretty">Find your perfect study blend by connecting with peers in your major.</p>
          </div>
          <div className="glass p-5">
            <GraduationCap className="text-brand mb-3" size={24} />
            <h3 className="font-bold mb-1">Mentorship</h3>
            <p className="text-sm text-white/60 text-pretty">Steep your career with guidance from experienced upper-year students.</p>
          </div>
          <div className="glass p-5">
            <Leaf className="text-brand mb-3" size={24} />
            <h3 className="font-bold mb-1">Organic Growth</h3>
            <p className="text-sm text-white/60 text-pretty">Startups hire you directly for roles that match your unique flavor.</p>
          </div>
        </div>

        <button
          onClick={signInWithGoogle}
          className="btn-primary w-full md:w-auto flex items-center justify-center gap-3 px-12 py-4 text-lg font-bold shadow-xl shadow-brand/20 hover:scale-105 active:scale-95 transition-all"
        >
          <LogIn size={20} />
          Join MatchaMatch
        </button>
        
        <p className="mt-6 text-xs text-secondary uppercase tracking-[0.2em] font-medium">
          Exclusive for University Students & Startups
        </p>
      </motion.div>
    </div>
  );
}
