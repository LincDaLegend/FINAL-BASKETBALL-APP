import './globals.css';

export const metadata = {
  title: 'Basketball Tracker App',
  description: 'Basketball card sourcing dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

