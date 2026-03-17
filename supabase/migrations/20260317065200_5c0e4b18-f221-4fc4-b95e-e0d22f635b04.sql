-- Allow updating and deleting employees
CREATE POLICY "Anyone can update employees" ON public.employees FOR UPDATE TO public USING (true);
CREATE POLICY "Anyone can delete employees" ON public.employees FOR DELETE TO public USING (true);