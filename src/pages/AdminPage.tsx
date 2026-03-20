import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { ShiftSelector } from '@/components/ShiftSelector';
import { PendingRequests } from '@/components/PendingRequests';
import { ScheduleView } from '@/components/ScheduleView';
import { EmployeeManager } from '@/components/EmployeeManager';
import { AdminManager } from '@/components/AdminManager';
import { SHIFTS } from '@/lib/shifts';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Shield, RotateCcw, ClipboardList, CalendarCheck, Link as LinkIcon, FileSpreadsheet, LogOut, CheckCheck, Users, Eye, EyeOff, Home, ShieldCheck, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
    const url = 'https://shift-break-sync.vercel.app';
    navigator.clipboard.writeText(url);
    toast.success('Employee link copied to clipboard!');
  };

  const stats = [
    { label: 'Pending', value: pendingCount, color: 'text-slot-pending', bg: 'bg-slot-pending-bg' },
    { label: 'Approved', value: approvedCount, color: 'text-slot-available', bg: 'bg-slot-available-bg' },
    { label: 'Total Today', value: todayRequests.length, color: 'text-foreground', bg: 'bg-muted' },
    { label: 'Active Shift', value: SHIFTS[activeShift].label, color: 'text-primary', bg: 'bg-primary/5' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header text-header-foreground py-5 px-4 border-b border-header-foreground/10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-header-foreground/15 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-heading text-xl font-bold leading-tight">Admin Dashboard</h1>
                <p className="text-header-foreground/60 text-xs">
                  {SHIFTS[activeShift].label} • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" asChild className="bg-header-foreground/10 border border-header-foreground/20 text-header-foreground hover:bg-header-foreground/20 h-9">
                <Link to="/"><Home className="w-4 h-4 mr-1.5" />Home</Link>
              </Button>
              <Button size="sm" className="bg-header-foreground/10 border border-header-foreground/20 text-header-foreground hover:bg-header-foreground/20 h-9" onClick={handleCopyLink}>
                <LinkIcon className="w-4 h-4 mr-1.5" />Copy Link
              </Button>
              <Button size="sm" className="bg-destructive/80 text-destructive-foreground hover:bg-destructive h-9" onClick={() => signOut()}>
                <LogOut className="w-4 h-4 mr-1.5" />Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Controls Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <ShiftSelector />
            <div className="flex items-center gap-2 bg-card border rounded-lg px-3 py-2">
              {slotsVisible ? <Eye className="w-4 h-4 text-slot-available" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
              <span className="text-xs font-medium">Slots</span>
              <Switch
                checked={slotsVisible}
                onCheckedChange={(checked) => {
                  setSlotsVisible(checked);
                  toast.success(checked ? 'Slots are now visible' : 'Slots are now hidden');
                }}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleBulkApprove} disabled={pendingCount === 0} className="h-9 gap-1.5">
              <CheckCheck className="w-4 h-4" />
              Approve All ({pendingCount})
            </Button>
            <Button variant="destructive" size="sm" onClick={handleReset} className="h-9 gap-1.5">
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className={`${stat.bg} border-none shadow-none`}>
                <CardContent className="p-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{stat.label}</p>
                  <p className={`font-heading font-bold text-2xl ${stat.color}`}>{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto">
            <TabsTrigger value="requests" className="gap-1.5 text-sm data-[state=active]:shadow-sm">
              <ClipboardList className="w-4 h-4" />
              Requests
              {pendingCount > 0 && (
                <span className="ml-1 bg-slot-pending text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5 text-sm data-[state=active]:shadow-sm">
              <CalendarCheck className="w-4 h-4" />
              Schedule
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 text-sm data-[state=active]:shadow-sm">
              <FileSpreadsheet className="w-4 h-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5 text-sm data-[state=active]:shadow-sm">
              <Users className="w-4 h-4" />
              Team
            </TabsTrigger>
          </TabsList>

          {/* Requests Tab */}
          <TabsContent value="requests" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-slot-pending" />
                  Pending Requests
                </CardTitle>
                <CardDescription>Review and approve employee lunch requests</CardDescription>
              </CardHeader>
              <CardContent>
                <PendingRequests />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-slot-available" />
                  Approved Schedule
                </CardTitle>
                <CardDescription>Today's confirmed lunch schedule</CardDescription>
              </CardHeader>
              <CardContent>
                <ScheduleView />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-primary" />
                  Google Sheets Sync
                </CardTitle>
                <CardDescription>
                  Paste the Spreadsheet ID to auto-sync approved requests. The sheet must be shared with the service account.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Manage Admins
                </CardTitle>
                <CardDescription>Approve or revoke admin access for registered users</CardDescription>
              </CardHeader>
              <CardContent>
                <AdminManager />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Manage Employees
                </CardTitle>
                <CardDescription>Add or remove employees from the scheduling system</CardDescription>
              </CardHeader>
              <CardContent>
                <EmployeeManager />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
