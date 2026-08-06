import type { Metadata } from 'next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { requireUser } from '@/features/auth/server';
import {
  DensityLegend,
  MushafStrip,
  PageGrid,
  ProgressStats,
  RecordDialog,
  SurahList,
} from '@/features/memorisation';
import {
  getPageStatus,
  getSurahProgress,
} from '@/features/memorisation/server';
import { getDefaultEdition, getSurahs } from '@/features/quran/server';
import { DatabaseZap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Memorisation',
  description: 'Record and review what you have committed to memory.',
};

export default async function MemorisationPage() {
  await requireUser();

  const edition = await getDefaultEdition();

  // Every read below is scoped by RLS to the signed-in user; no id is passed.
  if (!edition) {
    return (
      <Alert variant="destructive">
        <DatabaseZap />
        <AlertTitle>No mushaf edition is configured</AlertTitle>
        <AlertDescription>
          <p>
            The Quran reference data has not been seeded. Run the migrations and
            <code className="mx-1">supabase/seed/quran_reference.sql</code>
            against your project, then reload.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  const [pages, surahs, surahProgress] = await Promise.all([
    getPageStatus(edition.id),
    getSurahs(),
    getSurahProgress(),
  ]);

  const hasProgress = pages.some((page) => page.memorised_ayahs > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Memorisation
          </h1>
          <p className="text-sm text-muted-foreground">
            {edition.name} · tap any page to mark it, or record a range.
          </p>
        </div>
        <RecordDialog
          editionId={edition.id}
          surahs={surahs}
          pageCount={edition.page_count}
        />
      </div>

      <ProgressStats pages={pages} />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold tracking-tight">
              The whole mushaf
            </h2>
            <DensityLegend />
          </div>
          <MushafStrip pages={pages} />
          {!hasProgress ? (
            <p className="text-sm text-muted-foreground">
              Nothing recorded yet. Once you start, this strip shows not just
              how much you have memorised but where it sits across the Quran.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">By page</TabsTrigger>
          <TabsTrigger value="surahs">By surah</TabsTrigger>
        </TabsList>

        <TabsContent value="pages" className="pt-6">
          <PageGrid pages={pages} editionId={edition.id} />
        </TabsContent>

        <TabsContent value="surahs" className="pt-6">
          <SurahList surahs={surahs} progress={surahProgress} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
