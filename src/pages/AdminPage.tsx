import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { ShiftSelector } from '@/components/ShiftSelector';
import { PendingRequests } from '@/components/PendingRequests';
import { ScheduleView } from '@/components/ScheduleView';
import { EmployeeManager } from '@/components/EmployeeManager';
import { SHIFTS } from '@/lib/shifts';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Shield, RotateCcw, ClipboardList, CalendarCheck, Link as LinkIcon, FileSpreadsheet, LogOut, CheckCheck, Users, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function AdminPage() {
  const { activeShift, resetSchedule, requests, spreadsheetId, setSpreadsheetId, bulkApprove, slotsVisible, setSlotsVisible } = useApp();
  const { signOut } = useAuth();
  const [sheetInput, setSheetInput] = useState(spreadsheetId);

  useEffect(() => { setSheetInput(spreadsheetId); }, [spreadsheetId]);
  const today = new Date().toISOString().split('T')[0];

  const todayRequests = requests.filter(r => r.date === today && r.shift === activeShift);
  const pendingCount = todayRequests.filter(r => r.status === 'pending').length;
  const approvedCount = todayRequests.filter(r => r.status === 'approved').length;

  const handleReset = () => {
    if (confirm('Reset all requests for today? This cannot be undone.')) {
      resetSchedule();
      toast.success('Schedule has been reset');
    }
  };

  const handleBulkApprove = async () => {
    if (pendingCount === 0) {
      toast.info('No pending requests to approve');
      return;
    }
    await bulkApprove();
    toast.success(`Approved ${pendingCount} request${pendingCount > 1 ? 's' : ''}`);
  };

  const handleCopyLink = () => {
    const url = window.location.origin + '/';
    navigator.clipboard.writeText(url);
    toast.success('Employee link copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header text-header-foreground py-6 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-6 h-6" />
                <h1 className="font-heading text-2xl font-bold">Admin Dashboard</h1>
              </div>
              <p className="text-header-foreground/70 text-sm">
                Manage lunch schedules • {SHIFTS[activeShift].label}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-header-foreground/30 text-header-foreground hover:bg-header-foreground/10"
                onClick={handleCopyLink}
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                Copy Employee Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-header-foreground/30 text-header-foreground hover:bg-header-foreground/10"
                onClick={() => signOut()}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Shift Control & Slot Visibility */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <ShiftSelector />
            <div className="flex items-center gap-2 bg-card border rounded-xl px-4 py-2">
              {slotsVisible ? <Eye className="w-4 h-4 text-slot-available" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              <span className="text-sm font-medium">Slots Visible</span>
              <Switch
                checked={slotsVisible}
                onCheckedChange={(checked) => {
                  setSlotsVisible(checked);
                  toast.success(checked ? 'Slots are now visible to employees' : 'Slots are now hidden from employees');
                }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleBulkApprove} className="gap-2" disabled={pendingCount === 0}>
              <CheckCheck className="w-4 h-4" />
              Approve All ({pendingCount})
            </Button>
            <Button variant="destructive" size="sm" onClick={handleReset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset Today
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Pending', value: pendingCount, color: 'text-slot-pending' },
            { label: 'Approved', value: approvedCount, color: 'text-slot-available' },
            { label: 'Total Today', value: todayRequests.length, color: 'text-foreground' },
            { label: 'Active Shift', value: SHIFTS[activeShift].label, color: 'text-primary' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl border p-4"
            >
              <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
              <p className={`font-heading font-bold text-xl ${stat.color}`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Google Sheets Config */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border p-5 shadow-sm mb-6"
        >
          <h2 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Google Sheets Sync
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Paste the Spreadsheet ID to auto-sync approved requests. The sheet must be shared with the service account.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Spreadsheet ID (from the URL)"
              value={sheetInput}
              onChange={e => setSheetInput(e.target.value)}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={() => {
                setSpreadsheetId(sheetInput);
                toast.success('Spreadsheet ID saved!');
              }}
            >
              Save
            </Button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border p-5 shadow-sm"
          >
            <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-slot-pending" />
              Pending Requests
              {pendingCount > 0 && (
                <span className="ml-auto bg-slot-pending-bg text-slot-pending text-xs font-medium px-2 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </h2>
            <PendingRequests />
          </motion.div>

          {/* Approved Schedule */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-2xl border p-5 shadow-sm"
          >
            <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-slot-available" />
              Approved Schedule
            </h2>
            <ScheduleView />
          </motion.div>
        </div>

        {/* Employee Management */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-2xl border p-5 shadow-sm"
        >
          <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Manage Employees
          </h2>
          <EmployeeManager />
        </motion.div>
      </div>
    </div>
  );
}
