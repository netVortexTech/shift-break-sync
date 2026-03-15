import { useApp } from '@/context/AppContext';
import { generateSlots, formatSlotRange, SHIFTS } from '@/lib/shifts';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';

export function ScheduleView() {
  const { requests, activeShift } = useApp();
  const today = new Date().toISOString().split('T')[0];
  const slots = generateSlots(activeShift);

  const approved = requests.filter(
    r => r.status === 'approved' && r.shift === activeShift && r.date === today
  );

  const slotGroups = slots.map(slot => {
    const range = formatSlotRange(slot);
    const employees = approved.filter(r => r.lunchTime === range);
    return { range, employees };
  }).filter(g => g.employees.length > 0);

  if (slotGroups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No approved schedules yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {slotGroups.map((group, i) => (
        <motion.div
          key={group.range}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="p-3 rounded-lg bg-card border"
        >
          <p className="font-heading font-semibold text-sm mb-2 text-foreground">{group.range}</p>
          <div className="space-y-1">
            {group.employees.map(emp => (
              <div key={emp.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                <span>{emp.employeeName}</span>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
