import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { LunchRequest, ShiftName, MAX_PER_SLOT } from '@/types/lunch';
import { supabase } from '@/integrations/supabase/client';

interface AppState {
  activeShift: ShiftName;
  setActiveShift: (s: ShiftName) => void;
  requests: LunchRequest[];
  addRequest: (employeeName: string, lunchTime: string) => Promise<void>;
  approveRequest: (id: string) => Promise<void>;
  rejectRequest: (id: string) => Promise<void>;
  resetSchedule: () => Promise<void>;
  getSlotCount: (lunchTime: string) => number;
  employees: string[];
  loading: boolean;
  spreadsheetId: string;
  setSpreadsheetId: (id: string) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeShift, setActiveShiftLocal] = useState<ShiftName>('morning');
  const [requests, setRequests] = useState<LunchRequest[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [spreadsheetId, setSpreadsheetIdLocal] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // Load employees
  useEffect(() => {
    supabase.from('employees').select('name').order('name').then(({ data }) => {
      if (data) setEmployees(data.map(e => e.name));
    });
  }, []);

  // Load active shift
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'active_shift').single().then(({ data }) => {
      if (data) setActiveShiftLocal(data.value as ShiftName);
    });

    supabase.from('app_settings').select('value').eq('key', 'spreadsheet_id').single().then(({ data }) => {
      if (data) setSpreadsheetIdLocal(data.value);
    });

    // Real-time for shift changes
    const channel = supabase.channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        const row = payload.new as any;
        if (row?.key === 'active_shift') {
          setActiveShiftLocal(row.value as ShiftName);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Load requests for today
  useEffect(() => {
    setLoading(true);
    supabase.from('lunch_requests').select('*').eq('date', today).then(({ data }) => {
      if (data) {
        setRequests(data.map(r => ({
          id: r.id,
          employeeName: r.employee_name,
          shift: r.shift as ShiftName,
          lunchTime: r.lunch_time,
          status: r.status as 'pending' | 'approved' | 'rejected',
          date: r.date,
          timestamp: r.created_at,
        })));
      }
      setLoading(false);
    });

    // Real-time for request changes
    const channel = supabase.channel('requests-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lunch_requests' }, (payload) => {
        const r = payload.new as any;
        if (r.date === today) {
          setRequests(prev => {
            if (prev.some(p => p.id === r.id)) return prev;
            return [...prev, {
              id: r.id,
              employeeName: r.employee_name,
              shift: r.shift as ShiftName,
              lunchTime: r.lunch_time,
              status: r.status as 'pending' | 'approved' | 'rejected',
              date: r.date,
              timestamp: r.created_at,
            }];
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lunch_requests' }, (payload) => {
        const r = payload.new as any;
        setRequests(prev => prev.map(p => p.id === r.id ? {
          ...p,
          status: r.status as 'pending' | 'approved' | 'rejected',
        } : p));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lunch_requests' }, (payload) => {
        const r = payload.old as any;
        setRequests(prev => prev.filter(p => p.id !== r.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [today]);

  const setActiveShift = useCallback(async (s: ShiftName) => {
    setActiveShiftLocal(s);
    await supabase.from('app_settings').update({ value: s, updated_at: new Date().toISOString() }).eq('key', 'active_shift');
  }, []);

  const addRequest = useCallback(async (employeeName: string, lunchTime: string) => {
    await supabase.from('lunch_requests').insert({
      employee_name: employeeName,
      shift: activeShift,
      lunch_time: lunchTime,
      status: 'pending',
      date: today,
    });
  }, [activeShift, today]);

  const approveRequest = useCallback(async (id: string) => {
    await supabase.from('lunch_requests').update({ status: 'approved' }).eq('id', id);
  }, []);

  const rejectRequest = useCallback(async (id: string) => {
    await supabase.from('lunch_requests').update({ status: 'rejected' }).eq('id', id);
  }, []);

  const resetSchedule = useCallback(async () => {
    await supabase.from('lunch_requests').delete().eq('date', today);
  }, [today]);

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
      employees, loading,
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
