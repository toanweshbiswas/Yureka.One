import React, { useEffect, useMemo, useState } from 'react'
import { format, getYear, isValid, parse, startOfDay } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Calendar } from '@shared/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover'
import { cn } from '@shared/lib/utils'

type DateFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  invalid?: boolean
  /** Extra class on the outer shell */
  shellClassName?: string
}

function parseYmd(value?: string): Date | undefined {
  if (!value) return undefined
  const d = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

/** Accept typed dates: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY. */
function parseFlexibleDate(raw: string): Date | undefined {
  const text = raw.trim()
  if (!text) return undefined
  const formats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'd/M/yyyy', 'dd-MM-yyyy', 'd-M-yyyy', 'dd MMM yyyy', 'd MMM yyyy']
  for (const f of formats) {
    const d = parse(text, f, new Date())
    if (isValid(d)) return startOfDay(d)
  }
  return undefined
}

function withinBounds(day: Date, minDate?: Date, maxDate?: Date) {
  if (minDate && day < startOfDay(minDate)) return false
  if (maxDate && day > startOfDay(maxDate)) return false
  return true
}

/**
 * Dark date control. shadcn Calendar + Popover.
 * Month/year dropdowns + direct typed entry. Value stays YYYY-MM-DD.
 */
export const DateField: React.FC<DateFieldProps> = ({
  className = '',
  shellClassName = '',
  invalid,
  disabled,
  value,
  onChange,
  name,
  id,
  required,
  min,
  max,
  placeholder,
  ...rest
}) => {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<Date>(() => parseYmd(value) || new Date())
  const [typed, setTyped] = useState('')
  const [typedError, setTypedError] = useState<string | null>(null)

  const selected = useMemo(() => parseYmd(value), [value])
  const minDate = useMemo(() => parseYmd(typeof min === 'string' ? min : undefined), [min])
  const maxDate = useMemo(() => parseYmd(typeof max === 'string' ? max : undefined), [max])

  const startMonth = useMemo(() => {
    if (minDate) return new Date(getYear(minDate), 0)
    return new Date(1920, 0)
  }, [minDate])

  const endMonth = useMemo(() => {
    if (maxDate) return new Date(getYear(maxDate), 11)
    const y = Math.max(getYear(new Date()) + 10, 2100)
    return new Date(y, 11)
  }, [maxDate])

  useEffect(() => {
    if (selected) setMonth(selected)
  }, [selected])

  useEffect(() => {
    if (open) {
      setTyped(selected ? format(selected, 'dd/MM/yyyy') : '')
      setTypedError(null)
    }
  }, [open, selected])

  const emit = (next: string) => {
    if (!onChange) return
    const target = { value: next, name: name || '' } as HTMLInputElement
    onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLInputElement>)
  }

  const commitDay = (day: Date | undefined, close = true) => {
    if (!day) {
      emit('')
      if (close) setOpen(false)
      return
    }
    if (!withinBounds(day, minDate, maxDate)) {
      setTypedError('Date is outside the allowed range')
      return
    }
    emit(format(day, 'yyyy-MM-dd'))
    setMonth(day)
    setTypedError(null)
    if (close) setOpen(false)
  }

  const commitTyped = () => {
    const text = typed.trim()
    if (!text) {
      commitDay(undefined)
      return
    }
    const day = parseFlexibleDate(text)
    if (!day) {
      setTypedError('Use DD/MM/YYYY or YYYY-MM-DD')
      return
    }
    commitDay(day)
  }

  const label = selected
    ? format(selected, 'dd MMM yyyy')
    : placeholder || 'Pick a date'

  return (
    <div
      className={cn('group relative', shellClassName)}
      data-invalid={invalid ? 'true' : undefined}
    >
      <input
        type="hidden"
        name={name}
        id={id}
        value={value || ''}
        required={required}
        readOnly
        {...rest}
      />
      <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-invalid={invalid || undefined}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl border bg-white/[0.04] py-3.5 pl-4 pr-4 text-left text-[14px] font-medium tracking-[-0.01em] outline-none transition-[border-color,background-color,transform] duration-150',
              'focus-visible:border-clay/45 focus-visible:bg-white/[0.06]',
              'active:scale-[0.995]',
              'disabled:opacity-40',
              'sm:pl-5 sm:pr-5 sm:py-4',
              invalid ? 'border-red-500/55' : 'border-white/[0.08]',
              className,
            )}
          >
            <CalendarIcon
              className="h-4 w-4 shrink-0 text-white/30 transition-colors group-focus-within:text-clay sm:h-[18px] sm:w-[18px]"
              aria-hidden
            />
            <span className={cn('min-w-0 flex-1 truncate', selected ? 'text-white' : 'text-white/25')}>
              {label}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="border-b border-white/10 px-3 pb-2.5 pt-3">
            <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
              Enter date
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="bday"
                placeholder="DD/MM/YYYY"
                value={typed}
                onChange={(e) => {
                  setTyped(e.target.value)
                  if (typedError) setTypedError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitTyped()
                  }
                }}
                className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-[13px] font-medium text-white outline-none placeholder:text-white/30 focus:border-clay/45"
              />
              <button
                type="button"
                onClick={commitTyped}
                className="shrink-0 rounded-xl bg-clay px-3 py-2 text-[12px] font-semibold text-black active:scale-[0.97]"
              >
                Set
              </button>
            </div>
            {typedError ? (
              <p className="mt-1.5 text-[11px] text-red-300">{typedError}</p>
            ) : (
              <p className="mt-1.5 text-[11px] text-white/35">Or pick month / year below</p>
            )}
          </div>
          <Calendar
            mode="single"
            selected={selected}
            month={month}
            onMonthChange={setMonth}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            disabled={[
              ...(minDate ? [{ before: minDate }] : []),
              ...(maxDate ? [{ after: maxDate }] : []),
            ]}
            onSelect={(day) => commitDay(day || undefined)}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export default DateField
