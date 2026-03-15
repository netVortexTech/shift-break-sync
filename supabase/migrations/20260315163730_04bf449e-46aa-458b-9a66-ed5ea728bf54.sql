
-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create app_settings table for active shift
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lunch_requests table
CREATE TABLE public.lunch_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_name TEXT NOT NULL,
  shift TEXT NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night')),
  lunch_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lunch_requests ENABLE ROW LEVEL SECURITY;

-- Employees: anyone can read
CREATE POLICY "Anyone can read employees" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Anyone can insert employees" ON public.employees FOR INSERT WITH CHECK (true);

-- App settings: anyone can read/write
CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Anyone can update settings" ON public.app_settings FOR UPDATE USING (true);
CREATE POLICY "Anyone can insert settings" ON public.app_settings FOR INSERT WITH CHECK (true);

-- Lunch requests: public access for scheduling
CREATE POLICY "Anyone can read requests" ON public.lunch_requests FOR SELECT USING (true);
CREATE POLICY "Anyone can create requests" ON public.lunch_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update requests" ON public.lunch_requests FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete requests" ON public.lunch_requests FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.lunch_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;

-- Seed employees
INSERT INTO public.employees (name) VALUES
  ('John'), ('Sarah'), ('David'), ('Alex'), ('Maria'),
  ('James'), ('Emma'), ('Michael'), ('Lisa'), ('Robert'),
  ('Anna'), ('Chris'), ('Kate'), ('Tom'), ('Sophie');

-- Seed default active shift
INSERT INTO public.app_settings (key, value) VALUES ('active_shift', 'morning');
