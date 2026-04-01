import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { SlotGrid } from '@/components/SlotGrid';
import { ScheduleView } from '@/components/ScheduleView';
import { SHIFTS } from '@/lib/shifts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { UtensilsCrossed, CalendarCheck, Send, Shield, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function EmployeePage() {
  const { employees, activeShift, addRequest, requests, slotsVisible } = useApp();

  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [search, setSearch] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // Filter employees based on search input
  const filteredEmployees = employees.filter(name =>
    name.toLowerCase().includes(search.toLowerCase())
  );

  const hasExisting = selectedEmployee && requests.some(
    r =>
      r.employeeName === selectedEmployee &&
      r.shift === activeShift &&
      r.date === today &&
      r.status !== 'rejected'
  );

  const handleSubmit = async () => {
    if (!selectedEmployee || !selectedSlot) {
      toast.error('Please select your name and a time slot');
      return;
    }

    if (hasExisting) {
      toast.error('You already have a request for this shift');
      return;
    }

    try {
      await addRequest(selectedEmployee, selectedSlot);
      toast.success('Request submitted for approval!');
      setSelectedSlot('');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('full') || msg.includes('maximum')) {
        toast.error('This slot is already full. Please choose another one.');
      } else {
        toast.error('Failed to submit request. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-header text-header-foreground py-6 px-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <UtensilsCrossed className="w-6 h-6" />
              <h1 className="font-heading text-2xl font-bold">Lunch Break Scheduler</h1>
            </div>
            <p className="text-header-foreground/70 text-sm">
              {SHIFTS[activeShift].label} • Select your name and choose a lunch slot
            </p>
          </div>

          <Link
            to="/admin"
            className="flex items-center gap-2 text-sm border border-header-foreground/30 rounded-lg px-3 py-2 hover:bg-header-foreground/10 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Admin
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Active shift */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground shadow-md">
            <CalendarCheck className="w-4 h-4" />
            {SHIFTS[activeShift].label}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* LEFT SIDE */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border p-5 shadow-sm"
            >
              <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-primary" />
                Book Your Lunch
              </h2>

              {/* NAME INPUT (AUTOCOMPLETE) */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Your Name
                </label>

                <div className="relative w-full max-w-xs">
                  <Input
                    placeholder="Type your name..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelectedEmployee('');
                    }}
                  />

                  {search && (
                    <div className="absolute z-50 w-full mt-1 bg-card border rounded-md shadow-md max-h-48 overflow-y-auto">
                      {filteredEmployees.length > 0 ? (
                        filteredEmployees.map(name => (
                          <div
                            key={name}
                            onClick={() => {
                              setSelectedEmployee(name);
                              setSearch(name);
                            }}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                          >
                            {name}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No match found
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Selected indicator */}
                {selectedEmployee && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Selected:{' '}
                    <span className="font-medium text-foreground">
                      {selectedEmployee}
                    </span>
                  </p>
                )}
              </div>

              {/* Existing warning */}
              {hasExisting && (
                <div className="mb-4 p-3 rounded-lg bg-slot-warning-bg border border-slot-warning/30 text-sm text-slot-warning">
                  You already have a pending or approved request for this shift.
                </div>
              )}

              {/* SLOT GRID */}
              {slotsVisible ? (
                <div className="mb-5">
                  <label className="block text-sm font-medium text-muted-foreground mb-3">
                    Available Slots
                  </label>

                  <SlotGrid
                    onSelect={(range) => setSelectedSlot(range)}
                    disabled={!selectedEmployee || !!hasExisting}
                  />
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-5 flex flex-col items-center justify-center py-10 px-4 rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/30"
                >
                  <EyeOff className="w-8 h-8 text-muted-foreground/50 mb-3" />
                  <p className="font-heading font-semibold text-foreground mb-1">
                    Slots Not Available Yet
                  </p>
                  <p className="text-sm text-muted-foreground text-center">
                    Your supervisor hasn't opened the slots for booking yet. Please wait — they'll appear here automatically.
                  </p>
                </motion.div>
              )}

              {/* SUBMIT */}
              {selectedSlot && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/20"
                >
                  <div>
                    <p className="text-sm text-muted-foreground">Selected slot</p>
                    <p className="font-heading font-semibold text-foreground">
                      {selectedSlot}
                    </p>
                  </div>

                  <Button onClick={handleSubmit} className="gap-2">
                    <Send className="w-4 h-4" />
                    Submit Request
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* RIGHT SIDE */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card rounded-2xl border p-5 shadow-sm"
            >
              <h2 className="font-heading font-semibold text-lg mb-4">
                Today's Schedule
              </h2>

              <ScheduleView />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
