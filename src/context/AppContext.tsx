import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { LunchRequest, ShiftName, MAX_PER_SLOT } from '@/types/lunch';
import { generateSlots, formatSlotRange } from '@/lib/shifts';

interface AppState {
  activeShift: ShiftName;
  setActiveShift: (s: ShiftName) => void;
  requests: LunchRequest[];
  addRequest: (employeeName: string, lunchTime: string) => void;
  approveRequest: (id: string) => void;
  rejectRequest: (id: string) => void;
  resetSchedule: () => void;
  getSlotCount: (lunchTime: string) => number;
  employees: string[];
}

const AppContext = createContext<AppState | null>(null);

const EMPLOYEES = [
  'John', 'Sarah', 'David', 'Alex', 'Maria',
  'James', 'Emma', 'Michael', 'Lisa', 'Robert',
  'Anna', 'Chris', 'Kate', 'Tom', 'Sophie',
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeShift, setActiveShift] = useState<ShiftName>('morning');
  const [requests, setRequests] = useState<LunchRequest[]>([]);

  const today = new Date().toISOString().split('T')[0];

  const addRequest = useCallback((employeeName: string, lunchTime: string) => {
    const req: LunchRequest = {
      id: crypto.randomUUID(),
      employeeName,
      shift: activeShift,
      lunchTime,
      status: 'pending',
      date: today,
      timestamp: new Date().toISOString(),
    };
    setRequests(prev => [...prev, req]);
  }, [activeShift, today]);

  const approveRequest = useCallback((id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r));
  }, []);

  const rejectRequest = useCallback((id: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r));
  }, []);

  const resetSchedule = useCallback(() => {
    setRequests([]);
  }, []);

  const getSlotCount = useCallback((lunchTime: string) => {
    return requests.filter(r =>
      r.lunchTime === lunchTime &&
      r.shift === activeShift &&
      r.date === today &&
      (r.status === 'approved' || r.status === 'pending')
    ).length;
  }, [requests, activeShift, today]);

  return (
    <AppContext.Provider value={{
      activeShift, setActiveShift,
      requests, addRequest, approveRequest, rejectRequest,
      resetSchedule, getSlotCount,
      employees: EMPLOYEES,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
