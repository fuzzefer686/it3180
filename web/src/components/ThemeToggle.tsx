import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('vecung-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* Storage có thể bị chặn. */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('vecung-theme', theme); } catch { /* Không bắt buộc lưu. */ }
  }, [theme]);
  return <button className="icon-button theme-toggle" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}>{theme === 'light' ? <Moon size={19}/> : <Sun size={19}/>}</button>;
}
