import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CheckSquare, Sparkles, ChevronLeft, ChevronRight, 
  Trash2, Send, Calendar, Target, BookOpen, Users, 
  LayoutDashboard, Heart, Cross, Briefcase, 
  Wallet, GraduationCap, Clock, Flame, UserPlus, 
  ShieldCheck, ListChecks, Gavel, Edit3, X, Save, Camera, 
  LogIn, UserCircle2, Key, Hash, Shield, ArrowRight, LogOut, Copy, Check, Volume2, Info, AlertCircle, Plus, CloudCheck, Settings, UsersRound, Trophy, ScrollText, UserCog, History, Filter, LayoutGrid, List, Repeat, 
  Zap, PieChart, BarChart3, ChevronDown, Medal, Star, Crown, StopCircle, RefreshCcw, CheckCircle2
} from 'lucide-react';
import { Task, ViewMode, AIChatMessage, PillarType, Profile, Goal, StudyEntry, FamilyRule, Family, ProfileRole, RecurrenceType, PriorityType, Milestone } from './types';
import { getAIResponse, parseSmartTask, generateSpeech } from './services/geminiService';

const PILLAR_COLORS: Record<PillarType, string> = {
  'Espiritual': 'bg-purple-100 text-purple-700',
  'Estudos': 'bg-blue-100 text-blue-700',
  'Trabalho': 'bg-slate-100 text-slate-700',
  'Saúde': 'bg-emerald-100 text-emerald-700',
  'Intelectual': 'bg-indigo-100 text-indigo-700',
  'Financeiro': 'bg-amber-100 text-amber-700',
  'Família': 'bg-rose-100 text-rose-700'
};

const PILLAR_BG: Record<PillarType, string> = {
  'Espiritual': 'bg-purple-500',
  'Estudos': 'bg-blue-500',
  'Trabalho': 'bg-slate-500',
  'Saúde': 'bg-emerald-500',
  'Intelectual': 'bg-indigo-500',
  'Financeiro': 'bg-amber-500',
  'Família': 'bg-rose-500'
};

const PRIORITY_COLORS: Record<PriorityType, string> = {
  'Alta': 'border-red-500 bg-red-50 text-red-700',
  'Média': 'border-amber-500 bg-amber-50 text-amber-700',
  'Baixa': 'border-slate-200 bg-white text-slate-600'
};

const PILLAR_OPTIONS: PillarType[] = ['Espiritual', 'Estudos', 'Trabalho', 'Saúde', 'Intelectual', 'Financeiro', 'Família'];
const RECURRENCE_OPTIONS: RecurrenceType[] = ['Diário', 'Semanal', 'Mensal', 'Anual'];
const PRIORITY_OPTIONS: PriorityType[] = ['Alta', 'Média', 'Baixa'];

// XP Logic
const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 15000, 30000];
const getLevel = (xp: number) => LEVEL_THRESHOLDS.findIndex(t => xp < t) === -1 ? LEVEL_THRESHOLDS.length : LEVEL_THRESHOLDS.findIndex(t => xp < t);
const getNextLevelXp = (xp: number) => {
  const level = getLevel(xp);
  return LEVEL_THRESHOLDS[level] || 1000000;
};

// Helper para data local segura (evita bugs de timezone)
const formatDateLocal = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const checkRecurrenceMatch = (baseDateStr: string, targetDateStr: string, recurrence: RecurrenceType) => {
  if (targetDateStr <= baseDateStr) return false;
  
  // Usar UTC para cálculo de diferença de dias para evitar problemas com horário de verão (DST)
  const b = new Date(baseDateStr);
  const t = new Date(targetDateStr);
  const utc1 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  const utc2 = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  
  const diffDays = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
  
  if (recurrence === 'Diário') return true;
  if (recurrence === 'Semanal') return diffDays % 7 === 0;
  if (recurrence === 'Mensal') {
      const bLocal = new Date(baseDateStr + 'T00:00:00');
      const tLocal = new Date(targetDateStr + 'T00:00:00');
      return bLocal.getDate() === tLocal.getDate();
  }
  if (recurrence === 'Anual') {
      const bLocal = new Date(baseDateStr + 'T00:00:00');
      const tLocal = new Date(targetDateStr + 'T00:00:00');
      return bLocal.getDate() === tLocal.getDate() && bLocal.getMonth() === tLocal.getMonth();
  }
  return false;
};

const App: React.FC = () => {
  // --- Auth & Data States ---
  const [families, setFamilies] = useState<Family[]>(() => {
    try {
        const saved = JSON.parse(localStorage.getItem('legado_all_families') || '[]');
        return saved.length > 0 ? saved : [{ id: 'fam-demo', name: 'Legado Alpha', uniqueCode: 'LEG-1234' }];
    } catch { return [{ id: 'fam-demo', name: 'Legado Alpha', uniqueCode: 'LEG-1234' }]; }
  });
  
  const [allProfiles, setAllProfiles] = useState<Profile[]>(() => {
    try {
        const profiles = JSON.parse(localStorage.getItem('legado_all_profiles') || '[]');
        return profiles.map((p: any) => ({ ...p, xp: p.xp || 0, level: p.level || 1 }));
    } catch { return []; }
  });

  const [currentUser, setCurrentUser] = useState<Profile | null>(() => {
    try {
        const saved = localStorage.getItem('legado_current_user');
        return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  
  // UI Flow States
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'family-choice'>('login');
  const [familyAction, setFamilyAction] = useState<'none' | 'create' | 'join'>('none');
  const [view, setView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [familySubView, setFamilySubView] = useState<'members' | 'rules' | 'ranking'>('ranking');
  
  // Agenda Specific States
  const [agendaType, setAgendaType] = useState<'daily' | 'monthly'>('daily');
  const [calendarDate, setCalendarDate] = useState(new Date()); 
  const [selectedMemberId, setSelectedMemberId] = useState<string>(''); 
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Estudos' | 'Trabalho' | 'Família'>('all');

  // Task Management States
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    date: '',
    time: '',
    pillar: 'Estudos' as PillarType,
    assignee: '',
    recurrence: undefined as RecurrenceType | undefined,
    priority: 'Média' as PriorityType
  });

  // Goal Management States
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalForm, setGoalForm] = useState({
      title: '',
      pillar: 'Intelectual' as PillarType,
      type: 'Curto' as 'Curto' | 'Médio' | 'Longo'
  });

  // Milestone Management States
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [milestoneTitle, setMilestoneTitle] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

  // Rule Management States
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleForm, setRuleForm] = useState({ title: '', description: '' });

  // Functional States
  const [selectedDate, setSelectedDate] = useState<string>(formatDateLocal(new Date()));
  const [inputText, setInputText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<AudioBufferSourceNode | null>(null);
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Data States
  const [tasks, setTasks] = useState<Task[]>(() => { try { return JSON.parse(localStorage.getItem('legado_tasks') || '[]') } catch { return [] }});
  const [goals, setGoals] = useState<Goal[]>(() => { try { return JSON.parse(localStorage.getItem('legado_goals') || '[]') } catch { return [] }});
  const [rules, setRules] = useState<FamilyRule[]>(() => { try { return JSON.parse(localStorage.getItem('legado_rules') || '[]') } catch { return [] }});
  const [aiChat, setAiChat] = useState<AIChatMessage[]>([]);

  // Feedback States
  const [authError, setAuthError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Persistence
  useEffect(() => {
    setIsSyncing(true);
    localStorage.setItem('legado_all_families', JSON.stringify(families));
    localStorage.setItem('legado_all_profiles', JSON.stringify(allProfiles));
    localStorage.setItem('legado_current_user', JSON.stringify(currentUser));
    localStorage.setItem('legado_tasks', JSON.stringify(tasks));
    localStorage.setItem('legado_goals', JSON.stringify(goals));
    localStorage.setItem('legado_rules', JSON.stringify(rules));
    const timer = setTimeout(() => setIsSyncing(false), 800);
    return () => clearTimeout(timer);
  }, [families, allProfiles, currentUser, tasks, goals, rules]);

  // Notification Timer
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  // Scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiChat]);

  const activeFamily = useMemo(() => families.find(f => f.id === currentUser?.familyId), [families, currentUser]);
  const todayStr = useMemo(() => formatDateLocal(new Date()), []);

  // Alert System Logic (Overdue/Upcoming)
  useEffect(() => {
    if (currentUser && view === ViewMode.DASHBOARD) {
        const overdueCount = tasks.filter(t => t.profileId === currentUser.id && !t.completed && t.date < todayStr).length;
        const todayCount = tasks.filter(t => t.profileId === currentUser.id && !t.completed && t.date === todayStr).length;

        if (overdueCount > 0) {
            const timer = setTimeout(() => {
                setNotification({ msg: `Atenção: ${overdueCount} deveres atrasados!`, type: 'error' });
            }, 1000);
            return () => clearTimeout(timer);
        } else if (todayCount > 0) {
            const timer = setTimeout(() => {
                setNotification({ msg: `Foco: ${todayCount} missões para hoje.`, type: 'success' });
            }, 1000);
            return () => clearTimeout(timer);
        }
    }
  }, [currentUser, view, tasks.length]);

  useEffect(() => {
    if (currentUser && !selectedMemberId) setSelectedMemberId(currentUser.id);
  }, [currentUser]);

  const familyMembers = useMemo(() => allProfiles.filter(p => p.familyId === currentUser?.familyId), [allProfiles, currentUser]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setNotification({ msg, type });
  };

  const getFilteredTasks = (dateStr: string, memberId: string) => {
    const familyMemberIds = new Set(familyMembers.map(m => m.id));

    // 1. Real tasks
    let realTasks = tasks.filter(t => {
      if (!familyMemberIds.has(t.profileId)) return false;
      if (t.date !== dateStr) return false;
      return t.profileId === memberId || t.isFamilyTask;
    });

    // 2. Virtual tasks
    let virtualTasks = tasks.filter(t => {
      if (!familyMemberIds.has(t.profileId)) return false;
      if (t.completed) return false;
      if (!t.recurrence) return false;
      if (t.date >= dateStr) return false;
      const isOwner = t.profileId === memberId || t.isFamilyTask;
      if (!isOwner) return false;
      return checkRecurrenceMatch(t.date, dateStr, t.recurrence);
    }).map(t => ({
      ...t,
      id: `virtual-${t.id}-${dateStr}`,
      date: dateStr,
      isVirtual: true,
    }));
    
    const memberProfile = allProfiles.find(p => p.id === memberId);
    let allTasks = [...realTasks, ...virtualTasks];

    if (memberProfile?.role === 'Outro' && currentUser?.id !== memberId) {
      allTasks = allTasks.filter(t => t.pillar === 'Família' || t.pillar === 'Saúde');
    }

    if (categoryFilter !== 'all') {
      allTasks = allTasks.filter(t => t.pillar === categoryFilter);
    }
    
    // Improved Sorting: Priority > Time > Title
    return allTasks.sort((a, b) => {
      const prioMap = { 'Alta': 0, 'Média': 1, 'Baixa': 2 };
      if (prioMap[a.priority] !== prioMap[b.priority]) return prioMap[a.priority] - prioMap[b.priority];
      
      if (a.time && b.time) return a.time.localeCompare(b.time);
      if (a.time && !b.time) return -1;
      if (!a.time && b.time) return 1;

      return a.title.localeCompare(b.title);
    });
  };

  const visibleTasks = useMemo(() => {
    if (filterOverdue) {
      const familyMemberIds = new Set(familyMembers.map(m => m.id));
      return tasks.filter(t => {
        if (!familyMemberIds.has(t.profileId)) return false;
        return (t.profileId === selectedMemberId || t.isFamilyTask) && !t.completed && t.date < todayStr;
      });
    }
    return getFilteredTasks(selectedDate, selectedMemberId);
  }, [filterOverdue, tasks, selectedMemberId, selectedDate, todayStr, categoryFilter, allProfiles, familyMembers]);

  const activeGoals = useMemo(() => goals.filter(g => g.profileId === currentUser?.id), [goals, currentUser]);
  const familyRules = useMemo(() => rules.filter(r => r.familyId === currentUser?.familyId), [rules, currentUser]);

  const dashboardData = useMemo(() => {
    if (!currentUser) return null;
    const todayTasks = getFilteredTasks(todayStr, currentUser.id);
    const total = todayTasks.length;
    const completed = todayTasks.filter(t => t.completed).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const nextTask = todayTasks.find(t => !t.completed); 
    const pillarCounts: Record<string, number> = {};
    todayTasks.forEach(t => { pillarCounts[t.pillar] = (pillarCounts[t.pillar] || 0) + 1; });

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

    return { todayTasks, total, completed, progress, nextTask, pillarCounts, greeting };
  }, [tasks, currentUser, todayStr, categoryFilter]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const ds = formatDateLocal(d); 
      const dayTasks = getFilteredTasks(ds, selectedMemberId);
      
      let status: 'none' | 'done' | 'partial' | 'pending' = 'none';
      if (dayTasks.length > 0) {
        const completedCount = dayTasks.filter(t => t.completed).length;
        if (completedCount === dayTasks.length) status = 'done';
        else if (completedCount > 0) status = 'partial';
        else status = 'pending';
      }
      days.push({ day: i, dateStr: ds, status, taskCount: dayTasks.length });
    }
    return days;
  }, [calendarDate, selectedMemberId, tasks, categoryFilter, familyMembers]);

  // --- Handlers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const { email, password } = e.currentTarget as any;
    const found = allProfiles.find(p => p.email === email.value && p.password === password.value);
    if (found) {
      setCurrentUser(found);
      setSelectedMemberId(found.id);
      setAuthMode(found.familyId ? 'login' : 'family-choice');
      if (found.familyId) setView(ViewMode.DASHBOARD);
      showToast(`Bem-vindo, ${found.name}`);
    } else {
      setAuthError("E-mail ou senha não coincidem.");
    }
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, password } = e.currentTarget as any;
    if (allProfiles.some(p => p.email === email.value)) {
      setAuthError("E-mail já está sendo usado.");
      return;
    }
    const newProfile: Profile = {
      id: Date.now().toString(),
      name: name.value,
      email: email.value,
      password: password.value,
      role: 'Outro',
      familyId: '',
      phrase: 'Foco no progresso.',
      mission: 'Desenvolver disciplina e gerar valor.',
      xp: 0,
      level: 1,
      avatar: ''
    };
    setAllProfiles([...allProfiles, newProfile]);
    setCurrentUser(newProfile);
    setSelectedMemberId(newProfile.id);
    setAuthMode('family-choice');
  };

  const handleCreateFamily = (e: React.FormEvent) => {
    e.preventDefault();
    const { familyName } = e.currentTarget as any;
    const newFam: Family = {
      id: 'fam-' + Date.now().toString(),
      name: familyName.value,
      uniqueCode: 'LEG-' + Math.random().toString(36).substring(2, 6).toUpperCase()
    };
    setFamilies([...families, newFam]);
    if (currentUser) {
      const updated = { ...currentUser, familyId: newFam.id, role: 'Pai' as ProfileRole };
      setAllProfiles(allProfiles.map(p => p.id === currentUser.id ? updated : p));
      setCurrentUser(updated);
      setView(ViewMode.DASHBOARD);
      showToast('Legado fundado com sucesso!');
    }
  };

  const handleJoinFamily = (e: React.FormEvent) => {
    e.preventDefault();
    const { code } = e.currentTarget as any;
    const cleanCode = code.value.trim().toUpperCase();
    let fam = families.find(f => f.uniqueCode === cleanCode);
    if (!fam && cleanCode.startsWith('LEG-')) {
      fam = { id: 'fam-' + Date.now().toString(), name: 'Legado Novo', uniqueCode: cleanCode };
      setFamilies([...families, fam]);
    }
    if (fam && currentUser) {
      const updated = { ...currentUser, familyId: fam.id };
      setAllProfiles(allProfiles.map(p => p.id === currentUser.id ? updated : p));
      setCurrentUser(updated);
      setView(ViewMode.DASHBOARD);
      showToast('Você ingressou no Legado!');
    } else {
      setAuthError("Código inválido.");
    }
  };

  const handleSmartInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !currentUser) return;
    if (view === ViewMode.AI) {
      const msg = inputText; setInputText('');
      setAiChat([...aiChat, { role: 'user', text: msg }]);
      setIsAiLoading(true);
      const reply = await getAIResponse(msg, { tasks, goals, activeProfile: currentUser });
      setIsAiLoading(false);
      setAiChat(prev => [...prev, { role: 'model', text: reply }]);
    } else {
      setIsAiLoading(true);
      const parsed = await parseSmartTask(inputText);
      setIsAiLoading(false);
      if (parsed) {
        const xp = parsed.priority === 'Alta' ? 50 : parsed.priority === 'Média' ? 30 : 15;
        const newTask: Task = {
           id: Date.now().toString(), 
           title: parsed.title, 
           completed: false, 
           date: parsed.date || selectedDate, 
           pillar: parsed.pillar, 
           profileId: currentUser.id, 
           priority: parsed.priority as PriorityType,
           xpReward: xp
        };
        setTasks([newTask, ...tasks]);
        showToast(`Dever criado: ${parsed.title}`, 'success');
      } else {
        const newTask: Task = { id: Date.now().toString(), title: inputText, completed: false, date: selectedDate, pillar: 'Intelectual', profileId: currentUser.id, priority: 'Média', xpReward: 30 };
        setTasks([newTask, ...tasks]);
        showToast('Dever criado (padrão)', 'success');
      }
      setInputText('');
    }
  };

  const openTaskModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        title: task.title,
        date: task.date,
        time: task.time || '',
        pillar: task.pillar,
        assignee: task.profileId,
        recurrence: task.recurrence,
        priority: task.priority
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        title: '',
        date: selectedDate,
        time: '',
        pillar: 'Estudos',
        assignee: selectedMemberId || currentUser?.id || '',
        recurrence: undefined,
        priority: 'Média'
      });
    }
    setShowTaskModal(true);
  };

  const handleSaveTask = () => {
    if (!taskForm.title.trim() || !currentUser) return;
    const xp = taskForm.priority === 'Alta' ? 50 : taskForm.priority === 'Média' ? 30 : 15;

    if (editingTask) {
      setTasks(tasks.map(t => t.id === editingTask.id ? { 
        ...t, 
        title: taskForm.title,
        date: taskForm.date,
        time: taskForm.time,
        pillar: taskForm.pillar,
        profileId: taskForm.assignee,
        recurrence: taskForm.recurrence,
        priority: taskForm.priority,
        xpReward: xp
      } : t));
      showToast('Dever atualizado');
    } else {
      const newTask: Task = {
        id: Date.now().toString(),
        title: taskForm.title,
        completed: false,
        date: taskForm.date,
        time: taskForm.time,
        pillar: taskForm.pillar,
        profileId: taskForm.assignee,
        isFamilyTask: false,
        recurrence: taskForm.recurrence,
        priority: taskForm.priority,
        xpReward: xp
      };
      setTasks([...tasks, newTask]);
      showToast('Dever criado com sucesso');
    }
    setShowTaskModal(false);
  };

  // Goal Handler
  const openGoalModal = () => {
    setGoalForm({ title: '', pillar: 'Intelectual', type: 'Curto' });
    setShowGoalModal(true);
  };

  const handleSaveGoal = () => {
    if (!goalForm.title.trim() || !currentUser) return;
    setGoals([...goals, { 
      id: Date.now().toString(), 
      title: goalForm.title, 
      pillar: goalForm.pillar, 
      deadline: '2025-12-31', 
      type: goalForm.type, 
      progress: 0, 
      profileId: currentUser.id, 
      milestones: [] 
    }]);
    setShowGoalModal(false);
    showToast('Objetivo fundado!', 'success');
  };

  const handleFinishGoal = (goal: Goal) => {
    if (!currentUser) return;
    const xpReward = goal.type === 'Longo' ? 1000 : goal.type === 'Médio' ? 500 : 250;
    
    const updatedProfiles = allProfiles.map(p => {
        if (p.id === currentUser.id) {
            const newXp = p.xp + xpReward;
            return { ...p, xp: newXp, level: getLevel(newXp) };
        }
        return p;
    });
    
    setAllProfiles(updatedProfiles);
    setCurrentUser(updatedProfiles.find(p => p.id === currentUser.id) || null);
    
    // Remove the goal (Archive it)
    setGoals(goals.filter(g => g.id !== goal.id));
    
    showToast(`MISSÃO CUMPRIDA! +${xpReward} XP`, 'success');
    speak(`Parabéns! O objetivo ${goal.title} foi conquistado com honra.`, 'goal-finish');
  };

  const getNextDate = (current: string, type: RecurrenceType) => {
    const [y, m, d] = current.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (type === 'Diário') date.setDate(date.getDate() + 1);
    if (type === 'Semanal') date.setDate(date.getDate() + 7);
    if (type === 'Mensal') date.setMonth(date.getMonth() + 1);
    if (type === 'Anual') date.setFullYear(date.getFullYear() + 1);
    return formatDateLocal(date);
  };

  const handleToggleTask = (taskId: string) => {
    if (taskId.startsWith('virtual-')) {
        showToast('Complete a tarefa original anterior primeiro.', 'error');
        return;
    }
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const isNowCompleted = !task.completed;
    let newTasksList = tasks.map(t => t.id === taskId ? { ...t, completed: isNowCompleted } : t);

    // XP Logic
    if (isNowCompleted) {
        const updatedProfiles = allProfiles.map(p => {
          if (p.id === task.profileId) {
             const newXp = (p.xp || 0) + task.xpReward;
             const newLevel = getLevel(newXp);
             if (newLevel > (p.level || 1) && p.id === currentUser?.id) {
               showToast(`LEVEL UP! Você agora é nível ${newLevel}!`, 'success');
             } else if (p.id === currentUser?.id) {
               showToast(`+${task.xpReward} XP Conquistado!`, 'success');
             }
             return { ...p, xp: newXp, level: newLevel };
          }
          return p;
        });
        setAllProfiles(updatedProfiles);
        if (currentUser && task.profileId === currentUser.id) {
           setCurrentUser(updatedProfiles.find(p => p.id === currentUser.id) || currentUser);
        }
    } else {
        const updatedProfiles = allProfiles.map(p => {
            if (p.id === task.profileId) {
               return { ...p, xp: Math.max(0, (p.xp || 0) - task.xpReward) };
            }
            return p;
        });
        setAllProfiles(updatedProfiles);
        if (currentUser && task.profileId === currentUser.id) {
            setCurrentUser(updatedProfiles.find(p => p.id === currentUser.id) || currentUser);
        }
    }

    // Recurrence Logic
    if (isNowCompleted && task.recurrence) {
        const nextDate = getNextDate(task.date, task.recurrence);
        const newTask: Task = {
            ...task,
            id: Date.now().toString(),
            date: nextDate,
            completed: false,
        };
        newTasksList = [...newTasksList, newTask];
        showToast('Próxima recorrência agendada');
    }
    setTasks(newTasksList);
  };

  // Milestone Logic
  const openMilestoneModal = (goalId: string) => {
    setSelectedGoalId(goalId);
    setMilestoneTitle('');
    setShowMilestoneModal(true);
  }

  const handleSaveMilestone = () => {
    if (!milestoneTitle.trim() || !selectedGoalId) return;
    setGoals(goals.map(g => g.id === selectedGoalId ? { ...g, milestones: [...(g.milestones || []), { id: Date.now().toString(), title: milestoneTitle, completed: false }] } : g));
    setShowMilestoneModal(false);
    showToast('Marco adicionado!', 'success');
  }

  const toggleMilestone = (goalId: string, msId: string) => {
    setGoals(goals.map(g => {
        if (g.id !== goalId) return g;
        const newMs = g.milestones?.map(m => m.id === msId ? { ...m, completed: !m.completed } : m) || [];
        // Auto Calculate Progress based on Milestones
        const completedCount = newMs.filter(m => m.completed).length;
        const progress = newMs.length > 0 ? Math.round((completedCount / newMs.length) * 100) : g.progress;
        return { ...g, milestones: newMs, progress };
    }));
  };

  // Rules Logic
  const openRuleModal = () => {
    setRuleForm({ title: '', description: '' });
    setShowRuleModal(true);
  }

  const handleSaveRule = () => {
    if (!ruleForm.title.trim() || !currentUser) return;
    setRules([...rules, { 
      id: Date.now().toString(), 
      title: ruleForm.title, 
      description: ruleForm.description, 
      icon: '📜', 
      familyId: currentUser.familyId 
    }]);
    setShowRuleModal(false);
    showToast('Nova lei decretada!', 'success');
  }

  const speak = async (text: string, id: string) => {
    if (isSpeaking) {
        if(currentAudio) { currentAudio.stop(); }
        setIsSpeaking(null);
        setCurrentAudio(null);
        if (isSpeaking === id) return; // Toggle off if clicking same button
    }
    setIsSpeaking(id);
    const source = await generateSpeech(text);
    if (source) { 
        setCurrentAudio(source);
        source.onended = () => { setIsSpeaking(null); setCurrentAudio(null); }; 
        source.start(); 
    } else {
        setIsSpeaking(null);
    }
  };

  // --- Renderers ---

  const renderTaskModal = () => (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-slideUp max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-slate-900">{editingTask ? 'Editar Dever' : 'Novo Dever'}</h3>
          <button onClick={() => setShowTaskModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} className="text-slate-500"/></button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">O que deve ser feito?</label>
            <input 
              value={taskForm.title}
              onChange={e => setTaskForm({...taskForm, title: e.target.value})}
              placeholder="Ex: Ler 10 páginas"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:border-indigo-500 font-bold text-sm text-slate-800"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Data</label>
                <input 
                  type="date"
                  value={taskForm.date}
                  onChange={e => setTaskForm({...taskForm, date: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-indigo-500 font-bold text-xs text-slate-800"
                />
             </div>
             <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Horário</label>
                <input 
                  type="time"
                  value={taskForm.time}
                  onChange={e => setTaskForm({...taskForm, time: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-indigo-500 font-bold text-xs text-slate-800"
                />
             </div>
          </div>

          <div>
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Prioridade</label>
             <div className="flex gap-2">
                {PRIORITY_OPTIONS.map(p => (
                   <button 
                     key={p} 
                     onClick={() => setTaskForm({...taskForm, priority: p})} 
                     className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${taskForm.priority === p ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200'}`}
                   >
                     {p}
                   </button>
                ))}
             </div>
          </div>

          <div>
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Frequência</label>
             <div className="flex flex-wrap gap-2">
               <button onClick={() => setTaskForm({...taskForm, recurrence: undefined})} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${!taskForm.recurrence ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200'}`}>Única</button>
               {RECURRENCE_OPTIONS.map(r => (
                 <button key={r} onClick={() => setTaskForm({...taskForm, recurrence: r})} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${taskForm.recurrence === r ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200'}`}>{r}</button>
               ))}
             </div>
          </div>

          <div>
             <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Pilar</label>
             <div className="flex flex-wrap gap-2">
               {PILLAR_OPTIONS.map(p => (
                 <button key={p} onClick={() => setTaskForm({...taskForm, pillar: p})} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wide border transition-all ${taskForm.pillar === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200'}`}>{p}</button>
               ))}
             </div>
          </div>

          {(currentUser?.role === 'Pai' || currentUser?.role === 'Mãe') && (
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Responsável</label>
              <select value={taskForm.assignee} onChange={e => setTaskForm({...taskForm, assignee: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-indigo-500 font-bold text-xs text-slate-800">
                {familyMembers.map(m => ( <option key={m.id} value={m.id}>{m.name} ({m.role})</option>))}
              </select>
            </div>
          )}

          <button onClick={handleSaveTask} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-600/20 active:scale-95 transition-transform mt-4">
            {editingTask ? 'Salvar Alterações' : 'Criar Dever'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderGoalModal = () => (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-slideUp">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-slate-900">Novo Objetivo</h3>
          <button onClick={() => setShowGoalModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} className="text-slate-500"/></button>
        </div>
        <div className="space-y-4">
            <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Objetivo</label>
                <input value={goalForm.title} onChange={e => setGoalForm({...goalForm, title: e.target.value})} placeholder="Ex: Ler 12 livros" className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:border-indigo-500 font-bold text-sm text-slate-800" autoFocus />
            </div>
            <div>
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Tipo de Prazo</label>
                 <div className="flex gap-2">
                     {['Curto', 'Médio', 'Longo'].map(t => (
                         <button key={t} onClick={() => setGoalForm({...goalForm, type: t as any})} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border transition-all ${goalForm.type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200'}`}>{t}</button>
                     ))}
                 </div>
            </div>
            <div>
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Pilar</label>
                 <select value={goalForm.pillar} onChange={e => setGoalForm({...goalForm, pillar: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-indigo-500 font-bold text-xs text-slate-800">
                    {PILLAR_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
            </div>
            <button onClick={handleSaveGoal} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-transform mt-2">Fundar Objetivo</button>
        </div>
      </div>
    </div>
  );

  const renderMilestoneModal = () => (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-slideUp">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-slate-900">Novo Marco</h3>
          <button onClick={() => setShowMilestoneModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} className="text-slate-500"/></button>
        </div>
        <div className="space-y-4">
            <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Título do Marco</label>
                <input value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} placeholder="Ex: Ler capítulo 1" className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:border-indigo-500 font-bold text-sm text-slate-800" autoFocus />
            </div>
            <button onClick={handleSaveMilestone} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-transform mt-2">Adicionar Marco</button>
        </div>
      </div>
    </div>
  );

  const renderRuleModal = () => (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-slideUp">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-slate-900">Nova Lei Familiar</h3>
          <button onClick={() => setShowRuleModal(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"><X size={20} className="text-slate-500"/></button>
        </div>
        <div className="space-y-4">
            <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Título da Lei</label>
                <input value={ruleForm.title} onChange={e => setRuleForm({...ruleForm, title: e.target.value})} placeholder="Ex: Respeito Mútuo" className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:border-indigo-500 font-bold text-sm text-slate-800" autoFocus />
            </div>
            <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-2 mb-1 block">Descrição</label>
                <textarea value={ruleForm.description} onChange={e => setRuleForm({...ruleForm, description: e.target.value})} placeholder="Ex: Não levantar a voz em discussões." className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 px-5 outline-none focus:border-indigo-500 font-bold text-xs text-slate-800 min-h-[80px]" />
            </div>
            <button onClick={handleSaveRule} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-transform mt-2">Decretar Lei</button>
        </div>
      </div>
    </div>
  );

  const renderAgendaControls = () => {
    const isAdmin = currentUser?.role === 'Pai' || currentUser?.role === 'Mãe';
    return (
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex bg-slate-200/50 p-1 rounded-[16px]">
            <button onClick={() => setAgendaType('daily')} className={`px-4 py-2 rounded-[12px] text-[10px] font-black uppercase transition-all flex items-center gap-2 ${agendaType === 'daily' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><List size={14}/> Diário</button>
            <button onClick={() => setAgendaType('monthly')} className={`px-4 py-2 rounded-[12px] text-[10px] font-black uppercase transition-all flex items-center gap-2 ${agendaType === 'monthly' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><LayoutGrid size={14}/> Mensal</button>
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as any)} className="bg-white border border-slate-100 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-slate-500 outline-none shadow-sm">
            <option value="all">Tudo</option>
            <option value="Estudos">Estudos</option>
            <option value="Trabalho">Trabalho</option>
            <option value="Família">Rotina</option>
          </select>
        </div>
        {isAdmin && agendaType === 'monthly' && (
          <div className="flex items-center gap-3 bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm group hover:border-indigo-200 transition-all">
            <UserCog size={18} className="text-indigo-400" />
            <div className="flex-1">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Visualizando Agenda de:</p>
               <select value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)} className="w-full bg-transparent text-sm font-black text-slate-800 outline-none">
                {familyMembers.map(m => ( <option key={m.id} value={m.id}>{m.name} ({m.role})</option>))}
              </select>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMonthlyCalendar = () => {
    const monthName = calendarDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return (
      <div className="bg-white rounded-[40px] p-8 border border-slate-100 shadow-sm animate-fadeIn relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none"><Calendar size={120} /></div>
        <div className="flex justify-between items-center mb-8 relative z-10">
          <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors"><ChevronLeft size={20}/></button>
          <div className="text-center">
             <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800 leading-none">{monthName}</h3>
             <button onClick={() => { setCalendarDate(new Date()); setSelectedDate(todayStr); }} className="text-[8px] font-black text-indigo-500 uppercase mt-2 tracking-widest hover:underline">Voltar para Hoje</button>
          </div>
          <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="p-3 hover:bg-slate-50 rounded-2xl transition-colors"><ChevronRight size={20}/></button>
        </div>
        <div className="grid grid-cols-7 mb-4">
          {weekDays.map(d => <div key={d} className="text-center text-[10px] font-black text-slate-300 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((dayObj, idx) => {
            if (!dayObj) return <div key={`empty-${idx}`} className="aspect-square" />;
            const isToday = dayObj.dateStr === todayStr;
            const isSelected = dayObj.dateStr === selectedDate;
            return (
              <button key={dayObj.dateStr} onClick={() => { setSelectedDate(dayObj.dateStr); setAgendaType('daily'); }} className={`aspect-square flex flex-col items-center justify-center rounded-2xl relative transition-all group ${isSelected ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : isToday ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-50 text-slate-800'}`}>
                <span className="text-xs font-black">{dayObj.day}</span>
                {dayObj.status !== 'none' && ( <div className={`w-1.5 h-1.5 rounded-full mt-1 ${ dayObj.status === 'done' ? 'bg-emerald-500' : dayObj.status === 'partial' ? 'bg-amber-500' : 'bg-red-500'} ${isSelected ? 'bg-white' : ''}`} />)}
                {dayObj.taskCount > 0 && !isSelected && <span className="absolute top-1 right-1 text-[7px] font-black text-slate-300 opacity-0 group-hover:opacity-100">{dayObj.taskCount}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // --- Main Render ---

  if (!currentUser || (currentUser && !currentUser.familyId && authMode === 'family-choice')) {
    return (
      <div className="max-w-md mx-auto h-screen bg-slate-900 flex flex-col p-8 text-white relative overflow-hidden">
        {notification && (
            <div className={`fixed top-4 left-1/2 -translate-x-1/2 w-[90%] p-4 rounded-2xl shadow-xl z-[100] font-bold text-xs flex items-center gap-3 backdrop-blur-md border animate-slideDown ${notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-red-500/90 border-red-400 text-white'}`}>
                {notification.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
                <span className="flex-1">{notification.msg}</span>
                <button onClick={() => setNotification(null)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={14} /></button>
            </div>
        )}
        <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-indigo-600 rounded-full blur-[150px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-600 rounded-full blur-[150px]" />
        </div>
        <div className="relative z-10 flex flex-col h-full justify-center space-y-8 animate-fadeIn">
          <div className="text-center space-y-3">
             <div className="w-20 h-20 bg-indigo-600 rounded-[30px] mx-auto flex items-center justify-center shadow-2xl shadow-indigo-600/30 mb-4 rotate-3 border border-white/10">
                <Shield size={40} className="-rotate-3"/>
             </div>
             <h1 className="text-4xl font-black tracking-tighter uppercase">Legado</h1>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em] opacity-80">Disciplina & Ordem</p>
          </div>
          {authError && <div className="bg-red-500/20 border border-red-500/30 p-4 rounded-2xl flex items-center gap-3 text-red-400 animate-shake text-xs font-bold"><AlertCircle size={16}/> {authError}</div>}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 animate-slideUp">
              <input name="email" type="email" placeholder="Seu E-mail" required className="w-full bg-slate-800/60 border border-slate-700 rounded-2xl py-4 px-6 outline-none focus:border-indigo-500 font-medium text-sm" />
              <input name="password" type="password" placeholder="Senha" required className="w-full bg-slate-800/60 border border-slate-700 rounded-2xl py-4 px-6 outline-none focus:border-indigo-500 font-medium text-sm" />
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 uppercase tracking-widest">Acessar Sistema</button>
              <button type="button" onClick={() => setAuthMode('signup')} className="w-full text-xs text-slate-500 font-bold hover:text-white transition-colors">Ainda não tem conta? Registrar</button>
            </form>
          )}
          {authMode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4 animate-slideUp">
              <input name="name" placeholder="Nome Completo" required className="w-full bg-slate-800/60 border border-slate-700 rounded-2xl py-4 px-6 outline-none focus:border-indigo-500 text-sm font-bold" />
              <input name="email" type="email" placeholder="Melhor E-mail" required className="w-full bg-slate-800/60 border border-slate-700 rounded-2xl py-4 px-6 outline-none focus:border-indigo-500 text-sm font-bold" />
              <input name="password" type="password" placeholder="Crie uma Senha" required className="w-full bg-slate-800/60 border border-slate-700 rounded-2xl py-4 px-6 outline-none focus:border-indigo-500 text-sm font-bold" />
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 transition-all active:scale-95 uppercase tracking-widest">Criar meu Perfil</button>
              <button type="button" onClick={() => setAuthMode('login')} className="w-full text-xs text-slate-500 font-bold hover:text-white">Já possuo acesso</button>
            </form>
          )}
          {authMode === 'family-choice' && (
            <div className="space-y-6 animate-slideUp">
               {familyAction === 'none' ? (
                <div className="grid grid-cols-1 gap-4">
                  <button onClick={() => setFamilyAction('create')} className="bg-slate-800/80 p-8 rounded-[40px] border border-slate-700 flex flex-col items-center gap-4 transition-all hover:bg-slate-700 group ring-1 ring-white/5">
                    <div className="w-16 h-16 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Plus size={32}/></div>
                    <div className="text-center"><h3 className="font-black text-lg">Fundar Legado</h3><p className="text-[10px] text-slate-500 uppercase tracking-widest">Nova Família</p></div>
                  </button>
                  <button onClick={() => setFamilyAction('join')} className="bg-slate-800/80 p-8 rounded-[40px] border border-slate-700 flex flex-col items-center gap-4 transition-all hover:bg-slate-700 group ring-1 ring-white/5">
                    <div className="w-16 h-16 bg-emerald-600/20 text-emerald-400 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><UsersRound size={32}/></div>
                    <div className="text-center"><h3 className="font-black text-lg">Unir-se a Família</h3><p className="text-[10px] text-slate-500 uppercase tracking-widest">Possuo um Código</p></div>
                  </button>
                </div>
              ) : familyAction === 'create' ? (
                <form onSubmit={handleCreateFamily} className="space-y-4 bg-slate-800/50 p-8 rounded-[40px] border border-slate-700 shadow-2xl">
                  <button type="button" onClick={() => setFamilyAction('none')} className="text-slate-500 flex items-center gap-2 text-[10px] font-black uppercase"><ChevronLeft size={14}/> Voltar</button>
                  <h3 className="text-center font-black text-indigo-400 uppercase tracking-widest text-sm mb-2">Nome do seu Legado</h3>
                  <input name="familyName" placeholder="Ex: Legado Santos" required className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 outline-none focus:border-indigo-500 text-sm font-bold text-center" />
                  <button type="submit" className="w-full bg-indigo-600 py-4 rounded-2xl font-black text-sm uppercase">Fundar Agora</button>
                </form>
              ) : (
                <form onSubmit={handleJoinFamily} className="space-y-4 bg-slate-800/50 p-8 rounded-[40px] border border-slate-700 shadow-2xl">
                  <button type="button" onClick={() => setFamilyAction('none')} className="text-slate-500 flex items-center gap-2 text-[10px] font-black uppercase"><ChevronLeft size={14}/> Voltar</button>
                  <h3 className="text-center font-black text-emerald-400 uppercase tracking-widest text-sm mb-2">Ingresso de Membro</h3>
                  <p className="text-[10px] text-slate-500 text-center italic">Use 'LEG-1234' para demonstração.</p>
                  <input name="code" placeholder="CÓDIGO LEG-XXXX" required className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-4 px-6 outline-none focus:border-emerald-500 text-sm font-black text-center tracking-widest uppercase" />
                  <button type="submit" className="w-full bg-emerald-600 py-4 rounded-2xl font-black text-sm uppercase">Unir-se ao Grupo</button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 flex flex-col shadow-2xl overflow-hidden relative border-x border-slate-200">
      
      {/* Improved Notification Toast */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 w-[90%] p-4 rounded-2xl shadow-xl z-[100] font-bold text-xs flex items-center gap-3 backdrop-blur-md border animate-slideDown ${notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 'bg-red-500/90 border-red-400 text-white'}`}>
            {notification.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span className="flex-1">{notification.msg}</span>
            <button onClick={() => setNotification(null)} className="hover:bg-white/20 p-1 rounded-full transition-colors"><X size={14} /></button>
        </div>
      )}

      {/* Universal Header */}
      <header className="p-5 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-50 shadow-lg shadow-indigo-900/10">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView(ViewMode.PROFILE); setFilterOverdue(false); }} className="w-10 h-10 rounded-[12px] bg-indigo-500 flex items-center justify-center font-black shadow-inner border border-white/10 overflow-hidden relative group">
            {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : currentUser.name[0]}
            <div className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-900 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">{getLevel(currentUser.xp)}</div>
          </button>
          <div>
            <h1 className="text-sm font-black tracking-tight leading-none mb-1">{currentUser.name}</h1>
            <div className="flex items-center gap-1.5">
               <span className="text-[9px] text-indigo-400 font-black uppercase tracking-[0.2em]">{activeFamily?.name}</span>
               {isSyncing ? <CloudCheck size={10} className="text-emerald-400 animate-pulse" /> : <CloudCheck size={10} className="text-slate-600" />}
            </div>
          </div>
        </div>
        <button onClick={() => { setCurrentUser(null); setView(ViewMode.DASHBOARD); setFilterOverdue(false); }} className="p-2 text-slate-500 hover:text-white transition-colors"><LogOut size={20} /></button>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-5 pb-36">
        
        {view === ViewMode.DASHBOARD && dashboardData && (
          <div className="space-y-6 animate-fadeIn">
            {/* HERO */}
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[40px] p-8 text-white shadow-2xl relative overflow-hidden ring-1 ring-white/10">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none"><ShieldCheck size={140} /></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                   <div>
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-1">{dashboardData.greeting}</p>
                     <h2 className="text-2xl font-black tracking-tight">Comandante {currentUser.name.split(' ')[0]}</h2>
                   </div>
                   <div className="flex flex-col items-end">
                      <div onClick={() => { navigator.clipboard.writeText(activeFamily?.uniqueCode || ''); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }} className="bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2 cursor-pointer active:scale-95 transition-transform">
                          <span className="text-[9px] font-black uppercase tracking-widest">{activeFamily?.uniqueCode}</span>
                          {copiedCode ? <Check size={10} className="text-emerald-400"/> : <Copy size={10} className="text-slate-400"/>}
                      </div>
                      <span className="text-[8px] font-black text-amber-400 mt-1 uppercase tracking-widest">{currentUser.xp} XP</span>
                   </div>
                </div>

                <div className="flex items-center gap-6">
                   <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center group">
                      <svg className="w-full h-full -rotate-90">
                        <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-indigo-950" />
                        <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-indigo-500 transition-all duration-1000 ease-out" strokeDasharray="226.2" strokeDashoffset={226.2 - (226.2 * dashboardData.progress) / 100} strokeLinecap="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-lg font-black">{dashboardData.progress}%</span>
                      </div>
                   </div>

                   <div className="flex-1">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Próxima Missão</p>
                      {dashboardData.nextTask ? (
                         <div onClick={() => handleToggleTask(dashboardData.nextTask!.id)} className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-colors group">
                            <div className={`w-5 h-5 rounded-lg border-2 border-indigo-500 flex items-center justify-center ${dashboardData.nextTask.completed ? 'bg-indigo-500' : ''}`}>
                               {dashboardData.nextTask.completed && <Check size={12} />}
                            </div>
                            <div className="flex-1 min-w-0">
                               <p className="text-sm font-bold truncate">{dashboardData.nextTask.title}</p>
                               <div className="flex items-center gap-2 mt-0.5">
                                 <span className="text-[8px] font-black bg-white/10 px-1.5 py-0.5 rounded text-indigo-300">{dashboardData.nextTask.pillar}</span>
                                 <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${dashboardData.nextTask.priority === 'Alta' ? 'bg-red-500/20 text-red-300' : 'bg-slate-500/20 text-slate-400'}`}>{dashboardData.nextTask.priority}</span>
                               </div>
                            </div>
                         </div>
                      ) : (
                        <div onClick={() => openTaskModal()} className="bg-white/5 border border-white/10 border-dashed p-3 rounded-2xl flex items-center gap-2 cursor-pointer hover:bg-white/10 transition-colors text-slate-400">
                           <Plus size={16} />
                           <span className="text-xs font-bold">Definir nova missão</span>
                        </div>
                      )}
                   </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3">
               <button onClick={() => openTaskModal()} className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex flex-col items-center gap-2 hover:border-indigo-200 transition-colors group active:scale-95">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><CheckSquare size={20}/></div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-tight">Novo Dever</span>
               </button>
               <button onClick={() => openGoalModal()} className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex flex-col items-center gap-2 hover:border-amber-200 transition-colors group active:scale-95">
                  <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Target size={20}/></div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-tight">Nova Meta</span>
               </button>
               <button onClick={() => setView(ViewMode.AI)} className="bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm flex flex-col items-center gap-2 hover:border-purple-200 transition-colors group active:scale-95">
                  <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"><Sparkles size={20}/></div>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-tight">Mentoria</span>
               </button>
            </div>

            {/* Daily Focus */}
            <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><PieChart size={14} className="text-indigo-500"/> Foco do Dia</h3>
                  <span className="text-[10px] font-bold text-slate-400">{dashboardData.total} deveres</span>
               </div>
               {dashboardData.total === 0 ? (
                 <div className="py-6 text-center text-slate-300 text-xs font-medium italic">Nenhum dever registrado hoje.</div>
               ) : (
                 <div className="space-y-3">
                    <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 w-full">
                       {Object.entries(dashboardData.pillarCounts).map(([pillar, count]) => ( <div key={pillar} style={{ width: `${(count / dashboardData.total) * 100}%` }} className={PILLAR_BG[pillar as PillarType]} />))}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2">
                       {Object.entries(dashboardData.pillarCounts).map(([pillar, count]) => (
                          <div key={pillar} className="flex items-center gap-1.5">
                             <div className={`w-2 h-2 rounded-full ${PILLAR_BG[pillar as PillarType]}`} />
                             <span className="text-[9px] font-bold text-slate-600 uppercase">{pillar} ({count})</span>
                          </div>
                       ))}
                    </div>
                 </div>
               )}
            </div>
          </div>
        )}

        {view === ViewMode.AGENDA && (
          <div className="space-y-4 animate-fadeIn">
            {renderAgendaControls()}
            {agendaType === 'monthly' ? renderMonthlyCalendar() : (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className={`flex justify-between items-center bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm transition-opacity ${filterOverdue ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                    <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(formatDateLocal(d)); }} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronLeft size={20}/></button>
                    <div className="text-center">
                      <p className="text-sm font-black text-slate-800">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}</p>
                      <p className="text-[10px] uppercase text-indigo-600 font-black tracking-widest">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}</p>
                    </div>
                    <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(formatDateLocal(d)); }} className="p-2 hover:bg-slate-50 rounded-xl transition-colors"><ChevronRight size={20}/></button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setFilterOverdue(!filterOverdue)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${filterOverdue ? 'bg-amber-500 text-white border-amber-600 shadow-lg shadow-amber-500/20' : 'bg-white text-slate-400 border-slate-100 hover:border-amber-200 hover:text-amber-500 shadow-sm'}`}>
                      {filterOverdue ? <History size={14} className="animate-spin-slow" /> : <AlertCircle size={14} />} {filterOverdue ? 'Ocultar Atrasos' : 'Ver Atrasos'}
                    </button>
                    <button onClick={() => openTaskModal()} className="w-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-indigo-500 transition-colors"><Plus size={24} /></button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {visibleTasks.length === 0 ? (
                    <div className="p-20 text-center space-y-4 opacity-20">
                      <ScrollText size={60} className="mx-auto" />
                      <p className="text-[10px] font-black uppercase tracking-[0.4em]">{filterOverdue ? 'Sem pendências atrasadas' : 'Dia sem registros'}</p>
                    </div>
                  ) : visibleTasks.map(t => (
                    <div key={t.id} className={`bg-white p-5 rounded-[32px] border flex items-center gap-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden ${PRIORITY_COLORS[t.priority].replace('text-', 'border-').split(' ')[0]} ${t.isVirtual ? 'opacity-60 border-dashed bg-slate-50' : ''}`}>
                      <button onClick={() => handleToggleTask(t.id)} className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all flex-shrink-0 ${t.completed ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/30' : t.isVirtual ? 'border-slate-300 cursor-not-allowed' : 'border-slate-200 hover:border-indigo-400'}`}>
                        {t.completed && <Check size={16}/>}
                        {t.isVirtual && <Repeat size={14} className="text-slate-300" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-black truncate ${t.completed ? 'line-through text-slate-300' : 'text-slate-800'}`}>{t.title} {t.isVirtual && <span className="text-[8px] font-normal italic text-slate-400">(Previsto)</span>}</p>
                        <div className="flex items-center flex-wrap gap-2 mt-1">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${PILLAR_COLORS[t.pillar]}`}>{t.pillar}</span>
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                          {t.time && <span className="text-[9px] font-black text-slate-400 flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded"><Clock size={10}/> {t.time}</span>}
                          {t.recurrence && <span className="text-[9px] font-black text-indigo-500 flex items-center gap-1"><Repeat size={10}/> {t.recurrence}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!t.isVirtual && (
                            <>
                            <button onClick={() => openTaskModal(t)} className="text-slate-300 hover:text-indigo-500 p-2"><Edit3 size={16}/></button>
                            <button onClick={() => setTasks(tasks.filter(tk => tk.id !== t.id))} className="text-slate-300 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                            </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === ViewMode.GOALS && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center px-2">
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">Estratégia</h2>
               <Trophy size={24} className="text-amber-500" />
            </div>
            <div className="space-y-4">
               {activeGoals.map(g => {
                 const isCompleted = g.progress === 100;
                 return (
                 <div key={g.id} className={`bg-white p-6 rounded-[32px] border shadow-sm space-y-4 relative group transition-all ${isCompleted ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100'}`}>
                    <div className="absolute top-4 right-4 flex gap-2">
                         {!g.milestones?.length && !isCompleted && (
                            <button onClick={() => handleFinishGoal(g)} className="text-slate-300 hover:text-emerald-500 transition-colors p-1" title="Concluir sem marcos"><CheckCircle2 size={18}/></button>
                         )}
                         <button onClick={() => setGoals(goals.filter(goal => goal.id !== g.id))} className="text-slate-200 hover:text-red-400 transition-colors p-1"><Trash2 size={16}/></button>
                    </div>
                    
                    <div className="flex justify-between items-start pr-12">
                       <div>
                          <h3 className="text-sm font-black text-slate-800">{g.title}</h3>
                          <p className="text-[9px] font-black uppercase text-indigo-500 tracking-widest mt-1">{g.type} Prazo • {g.milestones?.length || 0} Marcos</p>
                       </div>
                       <span className={`text-[10px] font-black ${isCompleted ? 'text-emerald-600' : 'text-slate-400'}`}>{g.progress}%</span>
                    </div>
                    
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                       <div className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-indigo-700'}`} style={{ width: `${g.progress}%` }} />
                    </div>

                    {isCompleted ? (
                        <button onClick={() => handleFinishGoal(g)} className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2 animate-pulse">
                            <Trophy size={16} /> Resgatar Recompensa
                        </button>
                    ) : (
                        <div className="pt-4 border-t border-slate-50 space-y-2">
                            {g.milestones?.map(m => (
                                <div key={m.id} onClick={() => toggleMilestone(g.id, m.id)} className="flex items-center gap-2 cursor-pointer opacity-80 hover:opacity-100">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${m.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'}`}>
                                        {m.completed && <Check size={10} />}
                                    </div>
                                    <span className={`text-xs font-medium ${m.completed ? 'line-through text-slate-300' : 'text-slate-600'}`}>{m.title}</span>
                                </div>
                            ))}
                            <button onClick={() => openMilestoneModal(g.id)} className="text-[9px] font-bold text-indigo-400 flex items-center gap-1 hover:text-indigo-600 mt-2 p-2 hover:bg-indigo-50 rounded-xl transition-colors w-full justify-center border border-dashed border-indigo-100">+ Adicionar Marco</button>
                        </div>
                    )}
                 </div>
               )})}
               <button onClick={openGoalModal} className="w-full py-8 border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-500 transition-all">+ Fundar Novo Objetivo</button>
            </div>
          </div>
        )}

        {view === ViewMode.FAMILY && (
          <div className="space-y-6 animate-fadeIn">
             <div className="flex gap-2 p-1.5 bg-slate-200/50 rounded-[24px] border border-slate-200/20">
                <button onClick={() => setFamilySubView('ranking')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${familySubView === 'ranking' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-500'}`}>Ranking</button>
                <button onClick={() => setFamilySubView('members')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${familySubView === 'members' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-500'}`}>Membros</button>
                <button onClick={() => setFamilySubView('rules')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all ${familySubView === 'rules' ? 'bg-white shadow-lg text-slate-900' : 'text-slate-500'}`}>Leis</button>
             </div>
             
             {familySubView === 'ranking' && (
                 <div className="space-y-4">
                     <div className="text-center mb-2">
                        <Medal size={40} className="mx-auto text-amber-400 mb-2 drop-shadow-lg" />
                        <h3 className="text-lg font-black text-slate-800">Elite do Legado</h3>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Disciplina Gera Honra</p>
                     </div>
                     {familyMembers.sort((a,b) => (b.xp || 0) - (a.xp || 0)).map((m, idx) => (
                         <div key={m.id} className="bg-white p-4 rounded-[28px] border border-slate-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
                             <div className={`text-xl font-black w-8 text-center ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-amber-700' : 'text-slate-300'}`}>{idx + 1}</div>
                             <div className="w-12 h-12 rounded-xl bg-slate-100 relative overflow-hidden border border-slate-200">
                                 {m.avatar ? <img src={m.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-black text-slate-300">{m.name[0]}</div>}
                             </div>
                             <div className="flex-1">
                                 <h4 className="font-black text-sm text-slate-800">{m.name} {m.id === currentUser.id && '(Eu)'}</h4>
                                 <p className="text-[10px] font-bold text-indigo-500 uppercase">Nível {m.level || 1} • {m.role}</p>
                             </div>
                             <div className="text-right">
                                 <span className="block font-black text-slate-800">{m.xp || 0}</span>
                                 <span className="text-[8px] font-bold text-slate-400 uppercase">XP</span>
                             </div>
                             {idx === 0 && <Crown size={16} className="absolute top-2 right-2 text-amber-400 rotate-12" />}
                         </div>
                     ))}
                 </div>
             )}

             {familySubView === 'members' && (
                <div className="space-y-3">
                   {familyMembers.map(p => (
                     <div key={p.id} className="p-5 bg-white rounded-[32px] border border-slate-100 flex items-center gap-4 shadow-sm group">
                        <div className="w-14 h-14 rounded-[20px] bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xl shadow-inner group-hover:bg-indigo-50 transition-all">{p.avatar ? <img src={p.avatar} className="w-full h-full object-cover rounded-[20px]" /> : p.name[0]}</div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-slate-800">{p.name} {p.id === currentUser.id && <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full ml-2">EU</span>}</p>
                          <p className="text-[10px] uppercase text-indigo-500 font-black tracking-widest">{p.role}</p>
                        </div>
                     </div>
                   ))}
                </div>
             )}

             {familySubView === 'rules' && (
                <div className="space-y-4">
                   <div className="p-8 bg-slate-900 text-white rounded-[40px] border border-white/5 relative overflow-hidden text-center mb-2">
                      <ScrollText size={40} className="mx-auto mb-4 text-indigo-400" />
                      <h3 className="text-xl font-black mb-1">A Constituição</h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black opacity-60">Princípios Fundamentais</p>
                   </div>
                   {familyRules.map(r => (
                     <div key={r.id} className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm relative group">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-sm font-black text-slate-800 leading-tight pr-6">{r.title}</h4>
                          <button onClick={() => setRules(rules.filter(rule => rule.id !== r.id))} className="text-slate-100 group-hover:text-red-300 transition-colors"><Trash2 size={16}/></button>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">{r.description}</p>
                     </div>
                   ))}
                   <button onClick={openRuleModal} className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[32px] text-slate-400 font-black text-[10px] uppercase tracking-widest hover:border-indigo-300 hover:text-indigo-500 transition-all">+ Novo Artigo</button>
                </div>
             )}
          </div>
        )}

        {view === ViewMode.AI && (
             <div className="space-y-4 animate-fadeIn p-4">
                 <div className="bg-white p-4 rounded-[32px] border border-slate-100 shadow-sm h-[400px] overflow-y-auto flex flex-col gap-3">
                     {aiChat.length === 0 && (
                         <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                             <Sparkles size={48} className="mb-4 text-indigo-400"/>
                             <p className="text-sm font-black text-slate-400">Como posso ajudar, Comandante?</p>
                         </div>
                     )}
                     {aiChat.map((msg, i) => (
                         <div key={i} className={`p-3 rounded-2xl text-xs font-medium leading-relaxed max-w-[90%] ${msg.role === 'user' ? 'bg-slate-100 self-end text-slate-800 rounded-tr-sm' : 'bg-indigo-50 text-indigo-900 self-start rounded-tl-sm'}`}>
                             {msg.text}
                         </div>
                     ))}
                     {isAiLoading && (
                         <div className="p-3 bg-indigo-50 rounded-2xl rounded-tl-sm self-start flex gap-1">
                             <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"/>
                             <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-75"/>
                             <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-150"/>
                         </div>
                     )}
                     <div ref={chatEndRef} />
                 </div>
             </div>
        )}

        {view === ViewMode.PROFILE && (
            <div className="space-y-6 animate-fadeIn p-4">
                 <div className="text-center">
                    <div className="w-24 h-24 mx-auto bg-slate-200 rounded-[32px] mb-4 relative overflow-hidden border-4 border-white shadow-xl">
                       {currentUser.avatar ? <img src={currentUser.avatar} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-4xl font-black text-slate-400">{currentUser.name[0]}</div>}
                    </div>
                    <h2 className="text-xl font-black text-slate-800">{currentUser.name}</h2>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">{currentUser.role} • Nível {getLevel(currentUser.xp)}</p>
                 </div>
                 <div className="bg-white p-6 rounded-[32px] border border-slate-100 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Identidade</h3>
                    <div>
                       <label className="text-[10px] font-bold text-slate-400 block mb-1">Missão Pessoal</label>
                       <p className="text-sm font-medium text-slate-800 italic">"{currentUser.mission}"</p>
                    </div>
                 </div>
                 <button onClick={() => { setCurrentUser(null); setAuthMode('login'); }} className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors">Encerrar Sessão</button>
            </div>
        )}

      </main>

      {/* Bottom Input & Nav */}
      <div className="p-4 bg-white border-t border-slate-100 pb-8">
         <form onSubmit={handleSmartInput} className="relative flex items-center gap-2">
            {view !== ViewMode.DASHBOARD && (
               <button type="button" onClick={() => setView(ViewMode.DASHBOARD)} className="p-3 bg-slate-100 text-slate-500 rounded-2xl hover:bg-slate-200 transition-colors">
                  <LayoutDashboard size={20} />
               </button>
            )}
            <div className="flex-1 relative">
               <input 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder={view === ViewMode.AI ? "Converse com o Mentor..." : "Nova missão ou comando..."}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 pl-4 pr-12 outline-none focus:border-indigo-500 font-medium text-sm transition-all"
               />
               <button type="submit" disabled={!inputText.trim() || isAiLoading} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-xl disabled:opacity-50 disabled:bg-slate-300 transition-all active:scale-95 shadow-lg shadow-indigo-600/20">
                  {isAiLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Send size={16} />}
               </button>
            </div>
         </form>
      </div>

      {showTaskModal && renderTaskModal()}
      {showGoalModal && renderGoalModal()}
      {showMilestoneModal && renderMilestoneModal()}
      {showRuleModal && renderRuleModal()}
    </div>
  );
};

export default App;