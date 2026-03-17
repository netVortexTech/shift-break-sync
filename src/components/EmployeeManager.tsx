import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Check, X, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function EmployeeManager() {
  const { employees, addEmployee, updateEmployee, deleteEmployee } = useApp();
  const [newName, setNewName] = useState('');
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (employees.includes(trimmed)) {
      toast.error('Employee already exists');
      return;
    }
    await addEmployee(trimmed);
    setNewName('');
    toast.success(`Added ${trimmed}`);
  };

  const handleUpdate = async (oldName: string) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === oldName) {
      setEditingName(null);
      return;
    }
    if (employees.includes(trimmed)) {
      toast.error('Employee already exists');
      return;
    }
    await updateEmployee(oldName, trimmed);
    setEditingName(null);
    toast.success(`Renamed to ${trimmed}`);
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Remove ${name} from the employee list?`)) return;
    await deleteEmployee(name);
    toast.success(`Removed ${name}`);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Input
          placeholder="New employee name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="text-sm"
        />
        <Button size="sm" onClick={handleAdd} className="gap-1 shrink-0">
          <Plus className="w-4 h-4" />
          Add
        </Button>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {employees.map(name => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50 border"
            >
              {editingName === name ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <Input
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUpdate(name)}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slot-available" onClick={() => handleUpdate(name)}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingName(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium">{name}</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => { setEditingName(name); setEditValue(name); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(name)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
