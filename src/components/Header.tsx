interface HeaderProps {
  currentPath: string;
}

export function Header({ currentPath }: HeaderProps) {
  return (
    <header>
      <nav aria-label="Navegação principal">
        {[
          ['/', 'Início'],
          ['/login', 'Login'],
          ['/cadastro', 'Cadastro'],
          ['/busca', 'Busca'],
          ['/comparacao', 'Comparação'],
        ].map(([href, label]) => (
          <a key={href} href={`#${href}`} aria-current={currentPath === href ? 'page' : undefined}>
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
