'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Plus } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  useForm,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import {
  recordAyahsAction,
  recordPagesAction,
  recordSurahAction,
} from '../actions/memorisation-actions';
import {
  recordAyahsSchema,
  recordPagesSchema,
  recordSurahSchema,
  type RecordAyahsInput,
  type RecordPagesInput,
  type RecordSurahInput,
} from '../schemas/memorisation-schemas';

export interface SurahOption {
  number: number;
  name_transliterated: string;
  name_arabic: string;
  ayah_count: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const CONFIDENCE_LABELS: Record<string, string> = {
  '1': '1 — Very shaky',
  '2': '2 — Needs work',
  '3': '3 — Reasonable',
  '4': '4 — Solid',
  '5': '5 — Fluent',
};

/**
 * Shared metadata fields.
 *
 * Confidence, date and notes behave identically across all three entry modes,
 * so they are defined once. The three schemas genuinely share these keys but
 * are otherwise different shapes, so the field names are asserted against the
 * caller's form type rather than the component being typed to one schema.
 */
function MetadataFields<TValues extends FieldValues>({
  control,
  disabled,
}: {
  control: Control<TValues>;
  disabled: boolean;
}) {
  const dateField = 'memorisedOn' as FieldPath<TValues>;
  const confidenceField = 'confidence' as FieldPath<TValues>;
  const notesField = 'notes' as FieldPath<TValues>;

  return (
    <>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name={dateField}
          render={({ field }) => (
            <FormItem className="min-w-0">
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  value={typeof field.value === 'string' ? field.value : ''}
                  type="date"
                  max={today()}
                  disabled={disabled}
                  className="w-full min-w-0"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={confidenceField}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confidence</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value ? String(field.value) : undefined}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(CONFIDENCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name={notesField}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes</FormLabel>
            <FormControl>
              <Textarea
                name={field.name}
                ref={field.ref}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={typeof field.value === 'string' ? field.value : ''}
                rows={2}
                placeholder="Anything worth remembering about this session"
                disabled={disabled}
              />
            </FormControl>
            <FormDescription>Optional.</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

export function RecordDialog({
  editionId,
  surahs,
  pageCount,
}: {
  editionId: number;
  surahs: readonly SurahOption[];
  pageCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  const pagesForm = useForm<RecordPagesInput>({
    resolver: zodResolver(recordPagesSchema),
    defaultValues: {
      editionId,
      firstPage: 1,
      lastPage: 1,
      status: 'memorised',
      confidence: null,
      memorisedOn: today(),
      notes: '',
    },
  });

  const surahForm = useForm<RecordSurahInput>({
    resolver: zodResolver(recordSurahSchema),
    defaultValues: {
      surahNumber: 1,
      status: 'memorised',
      confidence: null,
      memorisedOn: today(),
      notes: '',
    },
  });

  const ayahsForm = useForm<RecordAyahsInput>({
    resolver: zodResolver(recordAyahsSchema),
    defaultValues: {
      firstAyah: 1,
      lastAyah: 7,
      status: 'memorised',
      confidence: null,
      memorisedOn: today(),
      notes: '',
    },
  });

  function finish(message: string) {
    setOpen(false);
    setFormError(null);
    pagesForm.reset();
    surahForm.reset();
    ayahsForm.reset();
    toast.success(message);
  }

  function submitPages(values: RecordPagesInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await recordPagesAction(values);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      const span =
        values.firstPage === values.lastPage
          ? `Page ${values.firstPage}`
          : `Pages ${values.firstPage}–${values.lastPage}`;
      finish(
        result.data.segmentsCreated === 0
          ? `${span} was already recorded.`
          : `${span} recorded.`
      );
    });
  }

  function submitSurah(values: RecordSurahInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await recordSurahAction(values);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      const name = surahs.find(
        (s) => s.number === Number(values.surahNumber)
      )?.name_transliterated;
      finish(
        result.data.segmentsCreated === 0
          ? `${name} was already recorded.`
          : `${name} recorded.`
      );
    });
  }

  function submitAyahs(values: RecordAyahsInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await recordAyahsAction(values);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      finish(
        result.data.segmentsCreated === 0
          ? 'Those ayahs were already recorded.'
          : `${result.data.ayahsAdded} ayahs recorded.`
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Record progress
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record progress</DialogTitle>
          <DialogDescription>
            Anything already recorded is left untouched, so overlapping entries
            are safe.
          </DialogDescription>
        </DialogHeader>

        {formError ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <Tabs defaultValue="pages">
          <TabsList className="w-full">
            <TabsTrigger value="pages" className="flex-1">
              Pages
            </TabsTrigger>
            <TabsTrigger value="surah" className="flex-1">
              Surah
            </TabsTrigger>
            <TabsTrigger value="ayahs" className="flex-1">
              Ayahs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pages" className="pt-4">
            <Form {...pagesForm}>
              <form
                onSubmit={pagesForm.handleSubmit(submitPages)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={pagesForm.control}
                    name="firstPage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From page</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={pageCount}
                            inputMode="numeric"
                            disabled={pending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={pagesForm.control}
                    name="lastPage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>To page</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={pageCount}
                            inputMode="numeric"
                            disabled={pending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <MetadataFields
                  control={pagesForm.control}
                  disabled={pending}
                />

                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? 'Saving' : 'Record pages'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="surah" className="pt-4">
            <Form {...surahForm}>
              <form
                onSubmit={surahForm.handleSubmit(submitSurah)}
                className="space-y-4"
              >
                <FormField
                  control={surahForm.control}
                  name="surahNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Surah</FormLabel>
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
                          {surahs.map((surah) => (
                            <SelectItem
                              key={surah.number}
                              value={String(surah.number)}
                            >
                              {surah.number}. {surah.name_transliterated} ·{' '}
                              {surah.ayah_count} ayahs
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <MetadataFields
                  control={surahForm.control}
                  disabled={pending}
                />

                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? 'Saving' : 'Record surah'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="ayahs" className="pt-4">
            <Form {...ayahsForm}>
              <form
                onSubmit={ayahsForm.handleSubmit(submitAyahs)}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={ayahsForm.control}
                    name="firstAyah"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From ayah</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={6236}
                            inputMode="numeric"
                            disabled={pending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={ayahsForm.control}
                    name="lastAyah"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>To ayah</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={1}
                            max={6236}
                            inputMode="numeric"
                            disabled={pending}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Global ayah numbers, 1 to 6,236 across the whole Quran. Use
                  this for partial pages.
                </p>

                <MetadataFields
                  control={ayahsForm.control}
                  disabled={pending}
                />

                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? 'Saving' : 'Record ayahs'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
