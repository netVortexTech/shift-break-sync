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
  bulkApprove: () => Promise<void>;
  resetSchedule: () => Promise<void>;
  getSlotCount: (lunchTime: string) => number;
  employees: string[];
  addEmployee: (name: string) => Promise<void>;
  updateEmployee: (oldName: string, newName: string) => Promise<void>;
  deleteEmployee: (name: string) => Promise<void>;
  loading: boolean;
  spreadsheetId: string;
  setSpreadsheetId: (id: string) => Promise<void>;
  slotsVisible: boolean;
  setSlotsVisible: (visible: boolean) => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeShift, setActiveShiftLocal] = useState<ShiftName>('morning');
  const [requests, setRequests] = useState<LunchRequest[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [spreadsheetId, setSpreadsheetIdLocal] = useState('');
  const [slotsVisible, setSlotsVisibleLocal] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Load employees
  useEffect(() => {
    const loadEmployees = () => {
      supabase.from('employees').select('name').order('name').then(({ data }) => {
        if (data) setEmployees(data.map(e => e.name));
      });
    };
    loadEmployees();

    const channel = supabase.channel('employees-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
        loadEmployees();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Load active shift
  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'active_shift').single().then(({ data }) => {
      if (data) setActiveShiftLocal(data.value as ShiftName);
    });

    supabase.from('app_settings').select('value').eq('key', 'spreadsheet_id').single().then(({ data }) => {
      if (data) setSpreadsheetIdLocal(data.value);
    });

    supabase.from('app_settings').select('value').eq('key', 'slots_visible').single().then(({ data }) => {
      if (data) setSlotsVisibleLocal(data.value === 'true');
    });

    const channel = supabase.channel('settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        const row = payload.new as any;
        if (row?.key === 'active_shift') {
          setActiveShiftLocal(row.value as ShiftName);
        }
        if (row?.key === 'slots_visible') {
          setSlotsVisibleLocal(row.value === 'true');
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

  const getResolvedSheetId = useCallback(() => {
    let sheetId = spreadsheetId;
    const match = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) sheetId = match[1];
    return sheetId;
  }, [spreadsheetId]);

  const syncToSheets = useCallback(async (rows: string[][]) => {
    if (!spreadsheetId) return;
    const sheetId = getResolvedSheetId();
    try {
      await supabase.functions.invoke('sync-to-sheets', {
        body: { spreadsheetId: sheetId, rows },
      });
    } catch (e) {
      console.error('Failed to sync to sheets:', e);
    }
  }, [spreadsheetId, getResolvedSheetId]);

  const approveRequest = useCallback(async (id: string) => {
    await supabase.from('lunch_requests').update({ status: 'approved' }).eq('id', id);

    if (spreadsheetId) {
      const req = requests.find(r => r.id === id);
      if (req) {
        await syncToSheets([[req.date, req.shift, req.employeeName, req.lunchTime, 'approved', new Date().toISOString()]]);
      }
    }
  }, [spreadsheetId, requests, syncToSheets]);

  const bulkApprove = useCallback(async () => {
    const pending = requests.filter(r => r.status === 'pending' && r.shift === activeShift && r.date === today);
    if (pending.length === 0) return;

    const ids = pending.map(r => r.id);
    await supabase.from('lunch_requests').update({ status: 'approved' }).in('id', ids);

    if (spreadsheetId) {
      const rows = pending.map(r => [r.date, r.shift, r.employeeName, r.lunchTime, 'approved', new Date().toISOString()]);
      await syncToSheets(rows);
    }
  }, [requests, activeShift, today, spreadsheetId, syncToSheets]);

  const setSpreadsheetId = useCallback(async (id: string) => {
    setSpreadsheetIdLocal(id);
    await supabase.from('app_settings').upsert({ key: 'spreadsheet_id', value: id, updated_at: new Date().toISOString() }, { onConflict: 'key' });
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

  // Employee CRUD
  const addEmployee = useCallback(async (name: string) => {
    await supabase.from('employees').insert({ name });
  }, []);

  const updateEmployee = useCallback(async (oldName: string, newName: string) => {
    await supabase.from('employees').update({ name: newName }).eq('name', oldName);
  }, []);

  const deleteEmployee = useCallback(async (name: string) => {
    await supabase.from('employees').delete().eq('name', name);
  }, []);

  return (
    <AppContext.Provider value={{
      activeShift, setActiveShift,
      requests, addRequest, approveRequest, rejectRequest, bulkApprove,
      resetSchedule, getSlotCount,
      employees, addEmployee, updateEmployee, deleteEmployee,
      loading,
      spreadsheetId, setSpreadsheetId,
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
