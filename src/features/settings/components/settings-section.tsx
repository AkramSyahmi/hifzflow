import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Shared shell so every settings block has identical structure and spacing. */
export function SettingsSection({
  title,
  description,
  children,
  destructive = false,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Card className={cn(destructive && 'border-destructive/40')}>
      <CardHeader>
        <CardTitle className={cn(destructive && 'text-destructive')}>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
