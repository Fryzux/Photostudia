import { ArrowLeft, Camera } from 'lucide-react';
import { Link } from 'react-router';

import { AuthPanel } from '../components/auth/AuthPanel';

export function LoginPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fafaf8_0%,#f3f3f0_100%)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col items-center px-4 py-6 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8 text-center sm:mb-10">
          <Link to="/" className="inline-flex flex-col items-center gap-4 text-[#111111]">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#111111]/12 bg-white sm:h-12 sm:w-12">
              <Camera className="h-5 w-5" />
            </div>
            <p className="text-4xl leading-none sm:text-5xl">Экспозиция</p>
          </Link>
          <Link to="/" className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#111111]/10 px-5 py-2 text-sm text-[#111111] transition hover:bg-white sm:mt-5">
            <ArrowLeft className="h-4 w-4" />
            Назад на главную
          </Link>
        </div>

        <div className="soft-fade w-full">
          <AuthPanel />
        </div>
      </div>
    </div>
  );
}
