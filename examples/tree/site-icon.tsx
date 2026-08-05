export default function Icon() {
  return (
    <svg viewBox="0 0 128 128" width={128} height={128}>
      <foreignObject width={128} height={128}>
        <div className="flex h-full flex-col items-center justify-center px-5">
          <div className="flex w-full flex-col gap-1.5 rounded-md border border-black/20 bg-white p-2 shadow dark:border-white/10 dark:bg-white/10 dark:shadow-dark">
            <div className="flex items-center gap-1.5">
              <div className="h-0 w-0 border-y-[3px] border-s-[5px] border-y-transparent border-s-black/60 dark:border-s-white/70" />
              <div className="h-1.5 w-12 rounded-[1px] bg-black/35 dark:bg-white/40" />
            </div>
            <div className="flex items-center gap-1.5 ps-3">
              <div className="h-0 w-0 rotate-90 border-y-[3px] border-s-[5px] border-y-transparent border-s-black/60 dark:border-s-white/70" />
              <div className="h-1.5 w-10 rounded-[1px] bg-black/35 dark:bg-white/40" />
            </div>
            <div className="h-1.5 w-8 rounded-[1px] bg-blue-600 ms-7 dark:bg-blue-500" />
            <div className="h-1.5 w-9 rounded-[1px] bg-black/35 ms-7 dark:bg-white/40" />
            <div className="h-1.5 w-11 rounded-[1px] bg-black/35 dark:bg-white/40" />
          </div>
        </div>
      </foreignObject>
    </svg>
  );
}
