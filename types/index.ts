// User types
export type UserRole = 'parent' | 'athlete' | 'admin' | 'youth_wrestler';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

// Athlete types
export interface Athlete {
  id: string;
  first_name: string;
  last_name: string;
  school: string;
  facility_id?: string;
  year?: 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | '5th Year';
  weight_class?: string;
  bio?: string;
  photo_url?: string;
  credentials?: Record<string, any>;
  average_rating: number;
  total_sessions: number;
  ytd_earnings: number;
  commitment_sessions: number;
  commitment_deadline?: string;
  commitment_fulfilled: boolean;
  bank_account_id?: string;
  usa_wrestling_expiration?: string;
  safesport_expiration?: string;
  background_check_expiration?: string;
  certifications_verified: boolean;
  active: boolean;
  created_at: string;
}

// Session types
export type SessionType = '1-on-1' | '2-athlete' | 'group';
export type SessionStatus = 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'pending_payment';
export type SessionMode = 'private' | 'sibling' | 'partner-invite' | 'partner-open';

export interface Session {
  id: string;
  parent_id: string;
  athlete_id: string;
  facility_id: string;
  youth_wrestler_id?: string;
  session_type: SessionType;
  session_mode?: SessionMode;
  partner_invite_code?: string;
  max_participants?: number;
  current_participants?: number;
  base_price?: number;
  price_per_participant?: number;
  scheduled_datetime: string;
  duration_minutes: number;
  total_price: number;
  athlete_payment: number;
  org_fee: number;
  stripe_fee: number;
  paid_with_credit: boolean;
  status: SessionStatus;
  athlete_paid: boolean;
  athlete_payout_date?: string;
  created_at: string;
  completed_at?: string;
}

export interface SessionParticipant {
  id: string;
  session_id: string;
  youth_wrestler_id: string;
  parent_id: string;
  paid: boolean;
  amount_paid?: number;
  created_at?: string;
}

export interface SessionJoinRequest {
  id: string;
  session_id: string;
  requesting_parent_id: string;
  youth_wrestler_id: string;
  message?: string;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  responded_at?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  read_at?: string;
  created_at: string;
}

// Facility types
export interface Facility {
  id: string;
  name: string;
  school: string;
  address?: string;
  created_at: string;
}

// Youth Wrestler types
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export interface YouthWrestler {
  id: string;
  parent_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  age?: number;
  school?: string;
  grade?: string;
  weight_class?: string;
  skill_level?: SkillLevel;
  wrestling_experience?: string;
  goals?: string;
  medical_notes?: string;
  photo_url?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

