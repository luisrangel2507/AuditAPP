import './globals.css';

export const metadata = {
  title: 'LPApp – Layered Process Audit',
  description: 'Auditorías por capas desde el teléfono',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.png?v=2', apple: '/apple-touch-icon.png?v=2' },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#22407f', viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Tema claro/oscuro: se fija antes de pintar para que no parpadee */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('lpa-theme');if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='dark'?'#0a1226':'#22407f'}catch(e){document.documentElement.dataset.theme='light'}" }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
