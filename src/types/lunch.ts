export type ShiftName = 'morning' | 'afternoon' | 'night';

export interface Shift {
  name: ShiftName;
  label: string;
  startHour: number;
  endHour: number;
}

export interface TimeSlot {
  id: string;
  start: string; // "09:00"
  end: string;   // "09:30"
  shift: ShiftName;
}

export interface LunchRequest {
  id: string;
  employeeName: string;
  shift: ShiftName;
  lunchTime: string; // "09:00 – 09:30"
  status: 'pending' | 'approved' | 'rejected';
  date: string;
  timestamp: string;
}

export interface Employee {
  id: string;
  name: string;
}

export const MAX_PER_SLOT = 3;
