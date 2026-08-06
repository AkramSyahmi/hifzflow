import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getMemoisedPages } from '@/app/actions/memorisation'
import { DensityStrip } from '@/components/mushaf/DensityStrip'
import { PageGrid } from '@/components/mushaf/PageGrid'

export default async function MushafPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const memorised = await getMemoisedPages()

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mushaf Progress</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {memorised.length} of 604 pages memorised
        </p>
      </div>

      <DensityStrip memorisedPages={memorised} />

      <PageGrid initialMemorised={memorised} />
    </main>
  )
}