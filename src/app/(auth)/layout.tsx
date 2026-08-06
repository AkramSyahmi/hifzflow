import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Auth shell.
 *
 * Single centred column rather than the usual split-screen with a decorative
 * panel: there is nothing true to put in that panel yet, and an empty gradient
 * would be filler. Revisit once there are real product screenshots.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-6 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {children}
    </div>
  );
}
