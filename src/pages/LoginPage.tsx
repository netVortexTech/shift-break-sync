import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, LogIn, Home } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isSignUp) {
      const { error } = await signUp(email, password);
      if (error) {
        toast.error(error);
      } else {
        toast.success('Account created! Check your email to verify, then sign in.');
        setIsSignUp(false);
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error);
      } else {
        navigate('/admin');
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">Admin Login</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage lunch schedules</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card rounded-2xl border p-6 shadow-sm space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full gap-2" disabled={submitting}>
            <LogIn className="w-4 h-4" />
            {submitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              className="text-primary hover:underline font-medium"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
