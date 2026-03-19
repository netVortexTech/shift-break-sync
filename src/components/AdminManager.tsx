import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ShieldCheck, ShieldX, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface UserWithRole {
  id: string;
  email: string;
  created_at: string;
  isAdmin: boolean;
}

export function AdminManager() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    // Get all users via security definer function
    const { data: allUsers, error } = await supabase.rpc('get_all_users');
    if (error) {
      toast.error('Failed to load users');
      setLoading(false);
      return;
    }

    // Get all admin roles
    const { data: roles } = await supabase.from('user_roles').select('user_id');
    const adminIds = new Set((roles || []).map(r => r.user_id));

    setUsers(
      (allUsers || []).map((u: any) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        isAdmin: adminIds.has(u.id),
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const grantAdmin = async (userId: string) => {
    setActing(userId);
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' as any, granted_by: user?.id });
    if (error) {
      toast.error('Failed to grant admin');
    } else {
      toast.success('Admin access granted');
      await fetchUsers();
    }
    setActing(null);
  };

  const revokeAdmin = async (userId: string) => {
    if (userId === user?.id) {
      toast.error("You can't revoke your own admin access");
      return;
    }
    setActing(userId);
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
    if (error) {
      toast.error('Failed to revoke admin');
    } else {
      toast.success('Admin access revoked');
      await fetchUsers();
    }
    setActing(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No registered users found.</p>;
  }

  return (
    <div className="space-y-2">
      {users.map(u => (
        <div
          key={u.id}
          className="flex items-center justify-between rounded-xl border bg-background px-4 py-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{u.email}</p>
            <p className="text-xs text-muted-foreground">
              {u.isAdmin ? '✅ Admin' : '⏳ Pending approval'}
            </p>
          </div>
          <div className="flex-shrink-0 ml-3">
            {u.id === user?.id ? (
              <span className="text-xs text-muted-foreground italic">You</span>
            ) : u.isAdmin ? (
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={acting === u.id}
                onClick={() => revokeAdmin(u.id)}
              >
                {acting === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldX className="w-3.5 h-3.5" />}
                Revoke
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={acting === u.id}
                onClick={() => grantAdmin(u.id)}
              >
                {acting === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Approve
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
