import { HifzScreen } from '@/components/brand/hifz-screen';
import { ThemeToggle } from '@/components/theme-toggle';

/**
 * Auth shell.
 *
 * The form column, and on wide screens the roof panel from the landing page:
 * the example breeze-block screen shows what the account is for. Below lg
 * the panel is dropped so the form is the whole screen on a phone.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative flex flex-col items-center justify-center px-6 py-12">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        {children}
      </div>

      <div className="dark hidden lg:flex lg:flex-col" aria-hidden="true">
        <div className="flex flex-1 items-center justify-center bg-roof px-14 py-12 text-foreground">
          <HifzScreen className="w-full max-w-[30rem]" />
        </div>
      </div>
    </div>
  );
}
