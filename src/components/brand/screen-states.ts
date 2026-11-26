/*
 * Page states on the example breeze-block screen, and the colour of each
 * block's opening on the roof-teal field. Kept outside the client component
 * so the server-rendered landing key can read the same values.
 */
export type ScreenState = 'manzil' | 'sabqi' | 'weak' | 'none';

export const SCREEN_OPENING: Record<ScreenState, string> = {
  manzil: 'bg-[oklch(0.88_0.09_178)]',
  sabqi: 'bg-[oklch(0.84_0.07_232)]',
  weak: 'bg-sun',
  none: 'bg-black/30',
};
