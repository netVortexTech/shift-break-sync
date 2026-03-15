import { Shift, ShiftName, TimeSlot } from '@/types/lunch';

export const SHIFTS: Record<ShiftName, Shift> = {
  morning: { name: 'morning', label: 'Morning Shift', startHour: 8, endHour: 16 },
  afternoon: { name: 'afternoon', label: 'Afternoon Shift', startHour: 16, endHour: 24 },
  night: { name: 'night', label: 'Night Shift', startHour: 0, endHour: 8 },
};

export function generateSlots(shiftName: ShiftName): TimeSlot[] {
  const shift = SHIFTS[shiftName];
  const lunchStart = shift.startHour + 1;
  const lunchEnd = shift.endHour - 1;
  const slots: TimeSlot[] = [];

  for (let h = lunchStart; h < lunchEnd; h++) {
    for (const m of [0, 30]) {
      const startMin = h * 60 + m;
      const endMin = startMin + 30;
      if (endMin > lunchEnd * 60) break;
      const fmt = (min: number) => {
        const hh = Math.floor(min / 60) % 24;
        const mm = min % 60;
        return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      };
      slots.push({
        id: `${shiftName}-${fmt(startMin)}`,
        start: fmt(startMin),
        end: fmt(endMin),
        shift: shiftName,
      });
    }
  }
  return slots;
}

export function formatSlotRange(slot: TimeSlot): string {
  return `${slot.start} – ${slot.end}`;
}
