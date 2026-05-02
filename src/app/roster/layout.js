import './globals.css';

export const metadata = {
  title: 'Paynter Bar Roster — GemLife Palmwoods',
  description: 'Volunteer roster management for the Paynter Bar',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
