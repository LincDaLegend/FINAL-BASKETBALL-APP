import './globals.css';

export const metadata = {
  title: 'Card Arb Engine',
  description: 'AI-powered basketball card arbitrage sourcing tool',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

