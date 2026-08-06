'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Settings2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  regenerateTodayAction,
  savePlanAction,
} from '../actions/murajaah-actions';
import { planSchema, type PlanInput } from '../schemas/murajaah-schemas';
import type { ReviewPlan } from '../queries/get-murajaah';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function PlanForm({
  plan,
  editionId,
  triggerLabel = 'Adjust plan',
}: {
  plan: ReviewPlan | null;
  editionId: number;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<PlanInput>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      editionId,
      mode: plan?.mode ?? 'daily_quantity',
      dailyPages: plan?.daily_pages ?? 4,
      cycleDays: plan?.cycle_days ?? 30,
      sabqiWindowDays: plan?.sabqi_window_days ?? 30,
      sabqiDailyPages: plan?.sabqi_daily_pages ?? 2,
      includeWeak: plan?.include_weak ?? true,
      weakThreshold: plan?.weak_threshold ?? 2,
      restDays: plan?.rest_days ?? [],
    },
  });

  const mode = form.watch('mode');
  const restDays = form.watch('restDays');

  function onSubmit(values: PlanInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await savePlanAction(values);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      // The day's queue was built against the old budget, so it has to be
      // rebuilt or the change appears not to have taken effect until midnight.
      await regenerateTodayAction();
      setOpen(false);
      toast.success(
        result.data.created ? 'Your plan is set.' : 'Plan updated.'
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={plan ? 'outline' : 'default'}>
          <Settings2 />
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Murajaah plan</DialogTitle>
          <DialogDescription>
            How much to review each day, and how recent material is treated.
          </DialogDescription>
        </DialogHeader>

        {formError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="mode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>How you plan</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={pending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily_quantity">
                        A fixed amount each day
                      </SelectItem>
                      <SelectItem value="cycle_length">
                        Everything, on a fixed cycle
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {mode === 'daily_quantity'
                      ? 'The daily load stays the same; the cycle gets longer as you memorise more.'
                      : 'The cycle stays the same; the daily load grows as you memorise more.'}
                  </FormDescription>
                </FormItem>
              )}
            />

            {mode === 'daily_quantity' ? (
              <FormField
                control={form.control}
                name="dailyPages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pages per day</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        max={60}
                        inputMode="numeric"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="cycleDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Days per full cycle</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        max={365}
                        inputMode="numeric"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormDescription>
                      Everything you know, reviewed once within this many days.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sabqiDailyPages"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sabqi pages</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        max={60}
                        inputMode="numeric"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormDescription>Of the daily budget.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sabqiWindowDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sabqi window</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        max={365}
                        inputMode="numeric"
                        disabled={pending}
                      />
                    </FormControl>
                    <FormDescription>Days counted as recent.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="weakThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Treat as weak at or below</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={String(field.value)}
                    disabled={pending}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[1, 2, 3, 4].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value} out of 5
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Weak pages are pulled forward, but never take more than a
                    third of the day, so the rotation keeps moving.
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="restDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rest days</FormLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((label, index) => {
                      const selected = restDays.includes(index);
                      return (
                        <button
                          key={label}
                          type="button"
                          disabled={pending}
                          aria-pressed={selected}
                          onClick={() => {
                            const next = selected
                              ? restDays.filter((day) => day !== index)
                              : [...restDays, index];
                            // Every day off would mean no plan at all.
                            if (next.length >= 7) return;
                            field.onChange(next);
                          }}
                          className={cn(
                            'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                            selected
                              ? 'border-transparent bg-secondary text-secondary-foreground'
                              : 'hover:bg-accent'
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <FormDescription>
                    Nothing is scheduled on these days.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving' : 'Save plan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
