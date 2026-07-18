import './globals.css';
import PwaRegister from './PwaRegister';

export const metadata = {
  title: 'Paynter Bar Roster — GemLife Palmwoods',
  description: 'Volunteer roster management for the Paynter Bar',
  manifest: '/manifest.json',
  applicationName: 'Paynter Bar Roster',
  appleWebApp: {
    capable: true,
    title: 'Bar Roster',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#1e3a5f',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
