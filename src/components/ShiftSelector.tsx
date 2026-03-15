import { useApp } from '@/context/AppContext';
import { SHIFTS } from '@/lib/shifts';
import { ShiftName } from '@/types/lunch';
import { Sun, Moon, Sunset } from 'lucide-react';

const shiftIcons: Record<ShiftName, typeof Sun> = {
  morning: Sun,
  afternoon: Sunset,
  night: Moon,
};

export function ShiftSelector() {
  const { activeShift, setActiveShift } = useApp();

  return (
    <div className="flex gap-2">
      {(Object.keys(SHIFTS) as ShiftName[]).map(key => {
        const shift = SHIFTS[key];
        const Icon = shiftIcons[key];
        const isActive = activeShift === key;

        return (
          <button
            key={key}
            onClick={() => setActiveShift(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-md'
                : 'bg-card text-muted-foreground hover:bg-secondary border'
            }`}
          >
            <Icon className="w-4 h-4" />
            {shift.label}
          </button>
        );
      })}
    </div>
  );
}
