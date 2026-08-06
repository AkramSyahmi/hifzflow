'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function togglePage(pageNumber: number) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('toggle_memorised_page', {
    p_page_number: pageNumber,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/mushaf')
}

export async function getMemoisedPages(): Promise<number[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('memorised_pages')
      .select('page_number')
      .order('page_number')
    if (error) {
      console.error('getMemoisedPages error:', error)
      return []  // return empty instead of throwing for now
    }
    return data.map((r) => r.page_number)
  }