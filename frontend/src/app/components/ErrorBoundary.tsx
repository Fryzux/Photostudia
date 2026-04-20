import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="mb-2 text-2xl font-semibold text-[#111111]">Что-то пошло не так</h2>
          <p className="mb-8 max-w-md text-[#5c5c5c]">
            При загрузке этого компонента произошла ошибка. Мы уже сообщили об этом технической поддержке.
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Обновить страницу
          </Button>
          {import.meta.env.DEV && (
            <pre className="mt-8 max-w-full overflow-auto rounded-xl bg-slate-100 p-4 text-left text-xs text-rose-700">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
