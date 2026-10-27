'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const navigation = [
  { href: '/dashboard', label: 'Início' },
  { href: '/characters', label: 'Personagens' },
  { href: '/campaigns', label: 'Campanhas' },
  { href: '/dice', label: 'Dados' },
  { href: '/manual', label: 'Manual' },
  { href: '/library', label: 'Biblioteca' },
] as const;

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated, logout } = useAuthStore();

  function handleLogout() {
    logout();
    router.push('/');
  }

  const visibleNavigation = user ? navigation : navigation.filter((item) => item.href === '/manual');

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-header-brand" aria-label="Eldoria RPG — página inicial">
          <span className="site-header-brand-mark" aria-hidden="true"><span>✦</span></span>
          <span>Eldoria RPG</span>
        </Link>

        {isHydrated && (
          <nav className="site-header-nav" aria-label="Navegação principal">
            {visibleNavigation.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="site-header-link"
                  aria-current={active ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {isHydrated && (
          <div className="site-header-actions">
            {user ? (
              <>
                <div className="site-header-user" title={user.displayName}>
                  <Avatar className="site-header-avatar h-8 w-8">
                    <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="site-header-user-name">{user.displayName}</span>
                </div>
                <button type="button" className="site-header-action" onClick={handleLogout}>
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="site-header-action">Entrar</Link>
                <Link href="/register" className="site-header-action site-header-action-primary">Criar conta</Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
