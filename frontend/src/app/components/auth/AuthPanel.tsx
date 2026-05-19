import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '../../context/AuthContext';
import { hasValidationErrors, validateLoginForm, validateRegisterForm } from '../../utils/validation';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

const emptyRegisterForm = {
  first_name: '',
  last_name: '',
  phone: '',
  email: '',
  username: '',
  password: '',
};


export function AuthPanel() {
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState(emptyRegisterForm);
  const [loginErrors, setLoginErrors] = useState<Partial<Record<'username' | 'password', string>>>({});
  const [registerErrors, setRegisterErrors] = useState<
    Partial<Record<'first_name' | 'email' | 'username' | 'password' | 'phone', string>>
  >({});
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validateLoginForm(loginData);
    setLoginErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      toast.error('Исправьте ошибки во входной форме.');
      return;
    }

    setLoading(true);
    try {
      await login(loginData);
      toast.success('Вход выполнен.');
      navigate('/profile');
    } catch (error: any) {
      toast.error(error.message || 'Не удалось выполнить вход.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors = validateRegisterForm(registerData);
    setRegisterErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      toast.error('Проверьте форму регистрации.');
      return;
    }

    setLoading(true);
    try {
      await register(registerData);
      toast.success('Аккаунт создан.');
      navigate('/halls');
    } catch (error: any) {
      toast.error(error.message || 'Не удалось завершить регистрацию.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Card className="mono-panel rounded-[2rem] border border-border">
        <CardContent className="p-6 sm:p-8 lg:p-10">
          <div className="space-y-6 text-center sm:space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-[0.32em] text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Личный кабинет
              </div>
              <h1 className="text-4xl text-foreground sm:text-6xl">Вход и регистрация</h1>
              <p className="mx-auto max-w-2xl text-lg leading-7 text-[#5f5f5f] dark:text-muted-foreground sm:text-xl sm:leading-8">
                Всё собрано в одном спокойном экране: доступ к залам, бронированиям, оплате и истории заказов.
              </p>
            </div>

            <Tabs defaultValue="login" className="w-full text-left">
              <TabsList className="mx-auto grid h-auto w-full max-w-md grid-cols-2 rounded-full bg-secondary p-1 dark:bg-white/10 dark:ring-1 dark:ring-white/10">
                <TabsTrigger
                  value="login"
                  className="rounded-full text-center dark:text-white/70 dark:data-[state=active]:bg-white dark:data-[state=active]:text-[#111111] dark:data-[state=active]:shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
                >
                  Вход
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="rounded-full text-center dark:text-white/70 dark:data-[state=active]:bg-white dark:data-[state=active]:text-[#111111] dark:data-[state=active]:shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
                >
                  Регистрация
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-8">
                <form onSubmit={handleLogin} className="mx-auto max-w-xl space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="block text-center text-xs uppercase tracking-[0.32em] text-muted-foreground">
                      Логин
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="username"
                      value={loginData.username}
                      onChange={(event) => setLoginData({ ...loginData, username: event.target.value })}
                      aria-invalid={!!loginErrors.username}
                      className="h-11 rounded-full border-border bg-card text-center text-sm sm:h-12 sm:text-base"
                    />
                    {loginErrors.username ? <p className="text-center text-sm text-rose-600">{loginErrors.username}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="block text-center text-xs uppercase tracking-[0.32em] text-muted-foreground">
                      Пароль
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="password"
                      value={loginData.password}
                      onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
                      aria-invalid={!!loginErrors.password}
                      className="h-11 rounded-full border-border bg-card text-center text-sm sm:h-12 sm:text-base"
                    />
                    {loginErrors.password ? <p className="text-center text-sm text-rose-600">{loginErrors.password}</p> : null}
                  </div>

                  <div className="flex justify-center">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="min-h-11 w-full rounded-full bg-[#111111] px-8 text-white shadow-[0_14px_30px_rgba(17,17,17,0.18)] hover:bg-foreground/90 dark:bg-white dark:text-[#111111] dark:shadow-[0_16px_34px_rgba(0,0,0,0.36)] dark:hover:bg-white/90 sm:min-w-52 sm:w-auto"
                    >
                      {loading ? 'Открываем сессию...' : 'Войти'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-8">
                <form onSubmit={handleRegister} className="mx-auto max-w-2xl space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reg-first-name" className="block text-center text-xs uppercase tracking-[0.32em] text-muted-foreground">
                        Имя
                      </Label>
                      <Input
                        id="reg-first-name"
                        type="text"
                        value={registerData.first_name}
                        onChange={(event) => setRegisterData({ ...registerData, first_name: event.target.value })}
                        aria-invalid={!!registerErrors.first_name}
                        className="h-11 rounded-full border-border bg-card text-center text-sm sm:h-12 sm:text-base"
                      />
                      {registerErrors.first_name ? <p className="text-center text-sm text-rose-600">{registerErrors.first_name}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-last-name" className="block text-center text-xs uppercase tracking-[0.32em] text-muted-foreground">
                        Фамилия
                      </Label>
                      <Input
                        id="reg-last-name"
                        type="text"
                        value={registerData.last_name}
                        onChange={(event) => setRegisterData({ ...registerData, last_name: event.target.value })}
                        className="h-11 rounded-full border-border bg-card text-center text-sm sm:h-12 sm:text-base"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="reg-email" className="block text-center text-xs uppercase tracking-[0.32em] text-muted-foreground">
                        Email
                      </Label>
                      <Input
                        id="reg-email"
                        type="email"
                        value={registerData.email}
                        onChange={(event) => setRegisterData({ ...registerData, email: event.target.value })}
                        aria-invalid={!!registerErrors.email}
                        className="h-11 rounded-full border-border bg-card text-center text-sm sm:h-12 sm:text-base"
                      />
                      {registerErrors.email ? <p className="text-center text-sm text-rose-600">{registerErrors.email}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-phone" className="block text-center text-xs uppercase tracking-[0.32em] text-muted-foreground">
                        Телефон
                      </Label>
                      <Input
                        id="reg-phone"
                        type="tel"
                        value={registerData.phone}
                        onChange={(event) => setRegisterData({ ...registerData, phone: event.target.value })}
                        aria-invalid={!!registerErrors.phone}
                        className="h-11 rounded-full border-border bg-card text-center text-sm sm:h-12 sm:text-base"
                      />
                      {registerErrors.phone ? <p className="text-center text-sm text-rose-600">{registerErrors.phone}</p> : null}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-username" className="block text-center text-xs uppercase tracking-[0.32em] text-muted-foreground">
                      Логин
                    </Label>
                    <Input
                      id="reg-username"
                      type="text"
                      value={registerData.username}
                      onChange={(event) => setRegisterData({ ...registerData, username: event.target.value })}
                      aria-invalid={!!registerErrors.username}
                      className="h-11 rounded-full border-border bg-card text-center text-sm sm:h-12 sm:text-base"
                    />
                    {registerErrors.username ? <p className="text-center text-sm text-rose-600">{registerErrors.username}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password" className="block text-center text-xs uppercase tracking-[0.32em] text-muted-foreground">
                      Пароль
                    </Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={registerData.password}
                      onChange={(event) => setRegisterData({ ...registerData, password: event.target.value })}
                      aria-invalid={!!registerErrors.password}
                      className="h-11 rounded-full border-border bg-card text-center text-sm sm:h-12 sm:text-base"
                    />
                    {registerErrors.password ? <p className="text-center text-sm text-rose-600">{registerErrors.password}</p> : null}
                  </div>

                  <div className="flex justify-center">
                    <Button
                      type="submit"
                      disabled={loading}
                      className="min-h-11 w-full rounded-full bg-[#111111] px-8 text-white shadow-[0_14px_30px_rgba(17,17,17,0.18)] hover:bg-foreground/90 dark:bg-white dark:text-[#111111] dark:shadow-[0_16px_34px_rgba(0,0,0,0.36)] dark:hover:bg-white/90 sm:min-w-52 sm:w-auto"
                    >
                      {loading ? 'Создаём аккаунт...' : 'Создать аккаунт'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>

            <div className="pt-2 text-center text-sm text-muted-foreground">
              <Link to="/" className="transition-colors hover:text-foreground">
                Вернуться на главную
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
