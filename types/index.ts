export interface Lead {
  id: string; company: string; website: string | null; domain: string | null;
  logo_url: string | null; email: string | null; phone: string | null;
  stage: string | null; arr_estimate: number | null; employees: number | null;
  tech_stack: string[] | null; intelligence_score: number;
  workflow: 'new'|'triaged'|'qualified'|'in_sequence'|'engaged'|'won'|'lost'|'do_not_contact';
  is_high_priority: boolean; is_archived: boolean; meta: Record<string, any>;
  created_at: string; updated_at: string;
}
export interface DashboardMetrics { total_companies: number; avg_score: number; }
export interface StageBreakdown { stage: string; company_count: number; }
