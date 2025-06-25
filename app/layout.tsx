import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

export const metadata: Metadata = {
  title: {
    default: "AnoChat - Anonymous Encrypted Chat",
    template: "%s | AnoChat"
  },
  description: "Zero-knowledge end-to-end encrypted anonymous chat application. Secure, private, and truly anonymous messaging.",
  keywords: ["anonymous", "chat", "encrypted", "privacy", "secure", "zero-knowledge", "E2EE"],
  authors: [{ name: "AnoChat Team" }],
  creator: "AnoChat",
  publisher: "AnoChat",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://anochat.vercel.app'),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://anochat.vercel.app',
    title: 'AnoChat - Anonymous Encrypted Chat',
    description: 'Zero-knowledge end-to-end encrypted anonymous chat application',
    siteName: 'AnoChat',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AnoChat - Anonymous Encrypted Chat',
    description: 'Zero-knowledge end-to-end encrypted anonymous chat application',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: '/manifest.json',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'msapplication-TileColor': '#0f172a',
    'msapplication-config': '/browserconfig.xml',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#d946ef' },
    { media: '(prefers-color-scheme: dark)', color: '#d946ef' },
  ],
};

// Service Worker Registration Component
function ServiceWorkerRegistration() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                  // Service Worker registered successfully
                  if (${process.env.NODE_ENV === 'development'}) {
                    console.log('[AnoChat] Service Worker registered successfully');
                    // Check for updates periodically (only in development)
                    setInterval(() => {
                      registration.update();
                    }, 10 * 60 * 1000);
                  }
                })
                .catch((registrationError) => {
                  // Service Worker registration failed
                  if (${process.env.NODE_ENV === 'development'}) {
                    console.error('[AnoChat ERROR] Service Worker registration failed', registrationError);
                  }
                });
            });
          }
          
          // Handle PWA install prompt
          let deferredPrompt;
          let showInstallPrompt = false;
          
          window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            showInstallPrompt = true;
            
            // Show custom install button if needed
            const installButton = document.getElementById('install-button');
            if (installButton) {
              installButton.style.display = 'block';
              installButton.addEventListener('click', async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  if (${process.env.NODE_ENV === 'development'}) {
                    console.log('[AnoChat] User response to install prompt:', outcome);
                  }
                  deferredPrompt = null;
                  showInstallPrompt = false;
                  installButton.style.display = 'none';
                }
              });
            }
          });
          
          window.addEventListener('appinstalled', () => {
            if (${process.env.NODE_ENV === 'development'}) {
              console.log('[AnoChat] PWA installed successfully');
            }
            showInstallPrompt = false;
            deferredPrompt = null;
          });
        `,
      }}
    />
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* PWA iOS Meta Tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="AnoChat" />
        
        {/* PWA Android Meta Tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="AnoChat" />
        
        {/* Windows Tile */}
        <meta name="msapplication-TileImage" content="/icon-192.png" />
        <meta name="msapplication-TileColor" content="#0f172a" />
        
        {/* Security Headers */}
        <meta httpEquiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' *.supabase.co wss://*.supabase.co; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com;" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="Referrer-Policy" content="no-referrer" />
        
        {/* Preload Critical Resources */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" suppressHydrationWarning={true}>
        <ErrorBoundary>
          <div className="min-h-screen bg-anon-900 text-anon-100">
            {children}
          </div>
        </ErrorBoundary>
        
        {/* Service Worker Registration */}
        <ServiceWorkerRegistration />
        
        {/* Install Button (hidden by default) */}
        <button
          id="install-button"
          style={{ display: 'none' }}
          className="fixed bottom-4 right-4 bg-phantom-600 hover:bg-phantom-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 z-50"
        >
          📱 Install App
        </button>
      </body>
    </html>
  );
}
