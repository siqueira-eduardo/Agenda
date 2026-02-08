
export type PillarType = 'Espiritual' | 'Estudos' | 'Trabalho' | 'Saúde' | 'Intelectual' | 'Financeiro' | 'Família';

export type ProfileRole = 'Pai' | 'Mãe' | 'Filho' | 'Filha' | 'Outro';

export interface Profile {
  id: string;
  name: string;
  role: ProfileRole;
  avatar?: string;
  bio?: string;
  birthday?: string;
  familyId: string; // Connection to a specific family entity
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
  assignedToName?: string; 
}

export interface FamilyRule {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface FamilyResponsibility {
  id: string;
  title: string;
  frequency: 'Diária' | 'Semanal' | 'Mensal';
  assignedProfileId: string;
}

export interface Goal {
  id: string;
  title: string;
  pillar: PillarType;
  deadline: string;
  type: 'Curto' | 'Médio' | 'Longo';
  progress: number; // 0 to 100
  profileId: string;
  description?: string;
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
  STUDY = 'estudos',
  FAMILY = 'família',
  AI = 'ai'
}

export interface AIChatMessage {
  role: 'user' | 'model';
  text: string;
}
