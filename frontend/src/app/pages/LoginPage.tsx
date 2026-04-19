import { ArrowLeft, Camera } from 'lucide-react';
import { Link } from 'react-router';
import { motion } from 'motion/react';

import { AuthPanel } from '../components/auth/AuthPanel';

export function LoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fafaf8]">
      {/* Decorative background elements */}
      <div className="absolute inset-0 z-0">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute -left-64 -top-64 h-[600px] w-[600px] rounded-full bg-[#111111]/[0.02] blur-3xl"
        />
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, -90, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute -right-64 -bottom-64 h-[700px] w-[700px] rounded-full bg-[#111111]/[0.03] blur-3xl"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#fafaf8_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center px-4 py-8 sm:px-6 lg:px-8 lg:py-16">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-10 text-center sm:mb-12"
        >
          <Link to="/" className="inline-flex flex-col items-center gap-5 text-[#111111]">
            <motion.div 
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-[#111111]/12 bg-white shadow-sm sm:h-16 sm:w-16"
            >
              <Camera className="h-6 w-6" />
            </motion.div>
            <p className="font-display text-5xl leading-none sm:text-6xl">Экспозиция</p>
          </Link>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#111111]/10 bg-white/50 px-6 py-2.5 text-sm font-medium text-[#434343] backdrop-blur-sm transition-all hover:bg-white hover:text-[#111111] hover:shadow-sm sm:mt-8">
              <ArrowLeft className="h-4 w-4" />
              Назад на главную
            </Link>
          </motion.div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <div className="mono-panel overflow-hidden rounded-[2.5rem] border border-[#111111]/8 bg-white/70 shadow-2xl backdrop-blur-xl">
             <AuthPanel />
          </div>
        </motion.div>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-sm text-[#737373]"
        >
          © 2026 Студия Экспозиция · Эстетика в каждом кадре
        </motion.p>
      </div>
    </div>
  );
}
