
export type PillarType = 'Espiritual' | 'Estudos' | 'Trabalho' | 'Saúde' | 'Intelectual' | 'Financeiro' | 'Família';

export type ProfileRole = 'Pai' | 'Mãe' | 'Filho' | 'Filha' | 'Outro';

export type RecurrenceType = 'Diário' | 'Semanal' | 'Mensal' | 'Anual';

export type PriorityType = 'Alta' | 'Média' | 'Baixa';

export interface Family {
  id: string;
  name: string;
  uniqueCode: string;
  vision?: string;
  values?: string[];
}

export interface Profile {
  id: string;
  name: string;
  role: ProfileRole;
  avatar?: string;
  email?: string;
  password?: string;
  familyId: string;
  // Identity & Mission
  bio?: string;
  phrase?: string;
  mission?: string;
  vision5Years?: string;
  strengths?: string[];
  weaknesses?: string[];
  birthday?: string;
  // Gamification
  xp: number;
  level: number;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  date: string;
  time?: string;
  pillar: PillarType;
  profileId: string;
  isFamilyTask?: boolean;
  recurrence?: RecurrenceType;
  priority: PriorityType;
  xpReward: number;
  isVirtual?: boolean;
}

export interface FamilyRule {
  id: string;
  title: string;
  description: string;
  icon: string;
  familyId: string;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface Goal {
  id: string;
  title: string;
  pillar: PillarType;
  deadline: string;
  type: 'Curto' | 'Médio' | 'Longo';
  progress: number; // Calculated based on milestones if present, or manual
  profileId: string;
  description?: string;
  milestones: Milestone[];
}

export interface StudyEntry {
  id: string;
  subject: string;
  category: 'Concurso' | 'Faculdade' | 'Idiomas' | 'Leitura';
  hours: number;
  date: string;
  profileId: string;
}

export enum ViewMode {
  DASHBOARD = 'dashboard',
  AGENDA = 'agenda',
  GOALS = 'metas',
  FAMILY = 'família',
  AI = 'ai',
  PROFILE = 'profile'
}

export interface AIChatMessage {
  role: 'user' | 'model';
  text: string;
}
