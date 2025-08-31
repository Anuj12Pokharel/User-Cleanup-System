// src/app/layout.tsx
import "./globals.css";
import Navigation from "../components/Navigation";

export const metadata = {
  title: "Neatly Cleanup",
  description: "Frontend for cleanup service",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="container">
            <h1 className="brand"> Cleanup System</h1>
            <Navigation />
          </div>
        </header>

        <main className="container content">{children}</main>

        <footer className="site-footer container">
          Built by Anuj Pokharel
        </footer>
      </body>
    </html>
  );
}