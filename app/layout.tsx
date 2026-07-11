import type { Metadata } from 'next';
import { Lora, Raleway } from 'next/font/google';

import './globals.css';

const headingFont = Lora({
  variable: '--font-heading',
  subsets: ['latin'],
  display: 'swap',
});

const bodyFont = Raleway({
  variable: '--font-body',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Health Compass | 找到适合你的健康方向',
    template: '%s | Health Compass',
  },
  description: '用几分钟完成健康测评，获得清晰、可执行的个人健康参考。',
};

interface RootLayoutProps {
  readonly children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps): React.ReactElement {
  return (
    <html lang="zh-CN" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
