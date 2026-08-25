import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { cn } from '@shared/lib/utils'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

const selectClass =
  'h-8 max-w-[7.5rem] cursor-pointer appearance-none rounded-xl border border-white/12 bg-[#16181d] px-2.5 text-[12px] font-semibold tracking-[-0.01em] text-white outline-none focus:border-clay/45 [color-scheme:dark]'

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-3',
        month_caption: cn(
          'flex justify-center relative items-center h-9',
          captionLayout !== 'label' && 'h-auto min-h-9 px-10 py-0.5',
        ),
        caption_label: 'text-[13px] font-semibold tracking-[-0.01em]',
        dropdowns: 'flex items-center justify-center gap-1.5',
        dropdown_root: 'relative',
        dropdown: selectClass,
        months_dropdown: selectClass,
        years_dropdown: selectClass,
        nav: 'flex items-center gap-1',
        button_previous:
          'absolute left-1 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white',
        button_next:
          'absolute right-1 top-1/2 z-10 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white',
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-white/35 rounded-md w-9 font-medium text-[11px]',
        week: 'flex w-full mt-1',
        day: 'relative p-0 text-center text-[13px] focus-within:relative focus-within:z-20',
        day_button: cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-xl font-medium transition-colors',
          'hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/45',
        ),
        selected:
          '[&>button]:bg-clay [&>button]:text-black [&>button]:hover:bg-clay [&>button]:hover:text-black',
        today: '[&>button]:border [&>button]:border-clay/40',
        outside: 'text-white/25 opacity-50',
        disabled: 'text-white/20 opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
      }}
      {...props}
    />
  )
}
Calendar.displayName = 'Calendar'

export { Calendar }
