import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { auth } from '../lib/firebase';
import { dbService } from '../services/dbService';
import { UserProfile, UserRole } from '../types';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { GraduationCap, Briefcase, Users, Check, LucideIcon } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    role: 'freshman' as UserRole,
    major: '',
    year: 1,
    bio: '',
    interests: [] as string[],
    companyName: '',
  });

  const roles: { value: UserRole, label: string, icon: LucideIcon, desc: string }[] = [
    { value: 'freshman', label: 'Freshman', icon: GraduationCap, desc: 'Looking for guidance and peers.' },
    { value: 'upper-year', label: 'Upper-Year', icon: Users, desc: 'Willing to mentor and network.' },
    { value: 'employer', label: 'Employer', icon: Briefcase, desc: 'Looking to hire talented students.' },
  ];

  const handleComplete = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    
    const profile: UserProfile = {
      uid: auth.currentUser.uid,
      displayName: auth.currentUser.displayName || 'New User',
      email: auth.currentUser.email || '',
      role: formData.role,
      major: formData.major,
      year: formData.year,
      bio: formData.bio,
      interests: formData.interests,
      companyName: formData.companyName,
      avatarUrl: auth.currentUser.photoURL || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await dbService.saveUser(profile);
      onComplete(profile);
    } catch (err) {
      console.error("Setup error:", err);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full overflow-y-auto custom-scrollbar">
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full text-center"
          >
            <h2 className="text-3xl font-display font-bold mb-8">What's your role?</h2>
            <div className="grid gap-4">
              {roles.map((role) => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.value}
                    onClick={() => { setFormData({ ...formData, role: role.value }); nextStep(); }}
                    className={`glass p-4 text-left flex items-center gap-4 hover:border-brand transition-all ${formData.role === role.value ? 'ring-2 ring-brand border-brand' : ''}`}
                  >
                    <div className="bg-white/5 p-3 rounded-xl"><Icon size={24} className="text-brand" /></div>
                    <div>
                      <div className="font-bold">{role.label}</div>
                      <div className="text-xs text-white/50">{role.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full"
          >
            <h2 className="text-3xl font-display font-bold mb-2 text-center">A bit more info</h2>
            <p className="text-white/50 text-center mb-8">Let others know what you are about.</p>
            
            <div className="space-y-4">
              {formData.role !== 'employer' ? (
                <>
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-widest mb-2 text-white/50">Major / Field</label>
                    <input
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors"
                      placeholder="e.g. Computer Science, ECE"
                      value={formData.major}
                      onChange={(e) => setFormData({ ...formData, major: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-widest mb-2 text-white/50">Year</label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors appearance-none"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5].map(y => <option key={y} value={y} className="bg-dark">{y} Year</option>)}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-mono uppercase tracking-widest mb-2 text-white/50">Startup / Company Name</label>
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors"
                    placeholder="e.g. TechFlow"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-mono uppercase tracking-widest mb-2 text-white/50">Bio</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-brand transition-colors h-32 resize-none"
                  placeholder="Tell us about yourself..."
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                />
              </div>
              <button
                disabled={loading || (formData.role !== 'employer' && !formData.major)}
                onClick={handleComplete}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? 'Setting up...' : <><Check size={20} /> Finish Setup</>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
