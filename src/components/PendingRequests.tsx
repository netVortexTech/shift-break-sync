import { useApp } from '@/context/AppContext';
import { SHIFTS } from '@/lib/shifts';
import { Button } from '@/components/ui/button';
import { Check, X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function PendingRequests() {
  const { requests, approveRequest, rejectRequest, activeShift } = useApp();
  const today = new Date().toISOString().split('T')[0];

  const pending = requests.filter(
    r => r.status === 'pending' && r.shift === activeShift && r.date === today
  );

  if (pending.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No pending requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {pending.map(req => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-center justify-between p-3 rounded-lg bg-slot-pending-bg border border-slot-pending/20"
          >
            <div>
              <p className="font-medium text-sm text-foreground">{req.employeeName}</p>
              <p className="text-xs text-muted-foreground">{req.lunchTime}</p>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 border-slot-available/50 text-slot-available hover:bg-slot-available-bg"
                onClick={() => approveRequest(req.id)}
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 border-destructive/50 text-destructive hover:bg-slot-full-bg"
                onClick={() => rejectRequest(req.id)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
