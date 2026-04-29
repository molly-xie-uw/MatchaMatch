import { motion } from 'framer-motion';

interface LoadingProps {
  fullScreen?: boolean;
}

export default function Loading({ fullScreen }: LoadingProps) {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? 'h-screen w-screen fixed inset-0 bg-dark z-50' : 'p-8'}`}>
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full"
      />
    </div>
  );
}
