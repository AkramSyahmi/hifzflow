type Props = {
    memorisedPages: number[]
    totalPages?: number
  }
  
  export function DensityStrip({ memorisedPages, totalPages = 604 }: Props) {
    const memorisedSet = new Set(memorisedPages)
  
    return (
      <div
        className="w-full h-3 rounded-full overflow-hidden bg-muted flex"
        aria-label={`${memorisedPages.length} of ${totalPages} pages memorised`}
        role="img"
      >
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <div
            key={page}
            className="flex-1 h-full"
            style={{
              backgroundColor: memorisedSet.has(page)
                ? 'hsl(var(--primary))'
                : 'transparent',
            }}
          />
        ))}
      </div>
    )
  }