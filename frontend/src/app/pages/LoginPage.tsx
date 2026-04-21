import { ArrowLeft, Camera } from 'lucide-react';
import { Link } from 'react-router';

import { AuthPanel } from '../components/auth/AuthPanel';

export function LoginPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fafaf8_0%,#f3f3f0_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col items-center px-4 py-6 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8 w-full max-w-3xl text-center sm:mb-10">
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <Link
              to="/"
              aria-label="На главную"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#111111]/12 bg-white text-[#111111] transition hover:bg-[#f4f4f1] sm:h-12 sm:w-12"
            >
              <Camera className="h-5 w-5" />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-[#111111]/10 px-5 py-2 text-sm text-[#111111] transition hover:bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Назад на главную
            </Link>
          </div>

          <Link to="/" className="mt-5 inline-flex text-[#111111] sm:mt-6">
            <p className="text-4xl leading-none sm:text-5xl">Экспозиция</p>
          </Link>
        </div>

        <div className="soft-fade w-full">
          <AuthPanel />
        </div>
      </div>
    </div>
  );
}
