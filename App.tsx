
import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckSquare, Sparkles, ChevronLeft, ChevronRight, 
  Trash2, Send, Calendar, Target, BookOpen, Users, 
  LayoutDashboard, Heart, Cross, Briefcase, 
  Wallet, GraduationCap, Clock, Award, Flame, UserPlus, 
  ShieldCheck, ListChecks, Info, Gavel, Edit3, X, Plus, Save, Camera, UserCircle, Cake
} from 'lucide-react';
import { Task, ViewMode, AIChatMessage, PillarType, Profile, Goal, StudyEntry, FamilyRule, FamilyResponsibility } from './types';
import { getAIResponse, parseSmartTask } from './services/geminiService';

const PILLAR_ICONS: Record<PillarType, React.ReactNode> = {
  'Espiritual': <Cross size={18} />,
  'Estudos': <GraduationCap size={18} />,
  'Trabalho': <Briefcase size={18} />,
  'Saúde': <Heart size={18} />,
  'Intelectual': <BookOpen size={18} />,
  'Financeiro': <Wallet size={18} />,
  'Família': <Users size={18} />
};

const PILLAR_COLORS: Record<PillarType, string> = {
  'Espiritual': 'bg-purple-100 text-purple-700',
  'Estudos': 'bg-blue-100 text-blue-700',
  'Trabalho': 'bg-slate-100 text-slate-700',
  'Saúde': 'bg-emerald-100 text-emerald-700',
  'Intelectual': 'bg-indigo-100 text-indigo-700',
  'Financeiro': 'bg-amber-100 text-amber-700',
  'Família': 'bg-rose-100 text-rose-700'
};

const DEFAULT_FAMILY_ID = 'legado-family-001';

const App: React.FC = () => {
  // Profiles state
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    const saved = localStorage.getItem('legado_profiles');
    return saved ? JSON.parse(saved) : [{ 
      id: 'eduardo', 
      name: 'Eduardo Siqueira', 
      role: 'Pai', 
      familyId: DEFAULT_FAMILY_ID,
      bio: 'Focado em disciplina e construção de um futuro sólido.',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'
    }];
  });
  const [activeProfileId, setActiveProfileId] = useState<string>(profiles[0].id);
  const activeProfile = profiles.find(p => p.id === activeProfileId)!;

  // View state
  const [view, setView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [familySubView, setFamilySubView] = useState<'members' | 'rules' | 'duties'>('members');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [inputText, setInputText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  // Data state
  const [tasks, setTasks] = useState<Task[]>(() => JSON.parse(localStorage.getItem('legado_tasks') || '[]'));
  const [goals, setGoals] = useState<Goal[]>(() => JSON.parse(localStorage.getItem('legado_goals') || '[]'));
  const [studies, setStudies] = useState<StudyEntry[]>(() => JSON.parse(localStorage.getItem('legado_studies') || '[]'));
  const [aiChat, setAiChat] = useState<AIChatMessage[]>([]);
  
  const [rules, setRules] = useState<FamilyRule[]>(() => {
    const saved = localStorage.getItem('legado_rules');
    return saved ? JSON.parse(saved) : [
      { id: '1', title: 'Ordem à Mesa', description: 'Sem aparelhos eletrônicos durante as refeições.', icon: '🍽️' },
      { id: '2', title: 'Prioridade Espiritual', description: 'Oração individual ao acordar e familiar no domingo.', icon: '🙏' },
      { id: '3', title: 'Verdade Absoluta', description: 'A honestidade é a base de toda confiança nesta casa.', icon: '⚖️' }
    ];
  });

  const [responsibilities, setResponsibilities] = useState<FamilyResponsibility[]>(() => {
    const saved = localStorage.getItem('legado_responsibilities');
    return saved ? JSON.parse(saved) : [
      { id: '1', title: 'Lixo e Organização Externa', frequency: 'Diária', assignedProfileId: 'eduardo' },
      { id: '2', title: 'Planejamento Financeiro Semanal', frequency: 'Semanal', assignedProfileId: 'eduardo' }
    ];
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem('legado_profiles', JSON.stringify(profiles));
    localStorage.setItem('legado_tasks', JSON.stringify(tasks));
    localStorage.setItem('legado_goals', JSON.stringify(goals));
    localStorage.setItem('legado_studies', JSON.stringify(studies));
    localStorage.setItem('legado_rules', JSON.stringify(rules));
    localStorage.setItem('legado_responsibilities', JSON.stringify(responsibilities));
  }, [profiles, tasks, goals, studies, rules, responsibilities]);

  // Derived calculations
  const dailyTasks = useMemo(() => tasks.filter(t => (t.profileId === activeProfileId || t.isFamilyTask) && t.date === selectedDate), [tasks, activeProfileId, selectedDate]);
  const activeGoals = useMemo(() => goals.filter(g => g.profileId === activeProfileId), [goals, activeProfileId]);
  const dailyStudyHours = useMemo(() => studies.filter(s => s.profileId === activeProfileId && s.date === selectedDate).reduce((sum, s) => sum + s.hours, 0), [studies, activeProfileId, selectedDate]);

  // Handlers
  const handleSmartInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (view === ViewMode.AI) {
      const userMsg = inputText;
      setInputText('');
      setAiChat(prev => [...prev, { role: 'user', text: userMsg }]);
      setIsAiLoading(true);
      const aiReply = await getAIResponse(userMsg, { tasks, goals, activeProfile });
      setIsAiLoading(false);
      setAiChat(prev => [...prev, { role: 'model', text: aiReply }]);
    } else {
      setIsAiLoading(true);
      const parsed = await parseSmartTask(inputText);
      setIsAiLoading(false);
      const newTask: Task = {
        id: Date.now().toString(),
        title: parsed?.title || inputText,
        completed: false,
        date: parsed?.date || selectedDate,
        pillar: (parsed?.pillar as PillarType) || 'Intelectual',
        profileId: activeProfileId
      };
      setTasks([newTask, ...tasks]);
      setInputText('');
    }
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const openProfileEditor = (profile: Profile) => {
    setEditingProfile({ ...profile });
    setIsProfileModalOpen(true);
  };

  const saveProfile = () => {
    if (editingProfile) {
      setProfiles(prev => prev.map(p => p.id === editingProfile.id ? editingProfile : p));
      setIsProfileModalOpen(false);
      setEditingProfile(null);
    }
  };

  const addProfile = () => {
    const newProfile: Profile = { 
      id: Date.now().toString(), 
      name: 'Novo Membro', 
      role: 'Outro',
      familyId: DEFAULT_FAMILY_ID,
      avatar: ''
    };
    setProfiles([...profiles, newProfile]);
    openProfileEditor(newProfile);
  };

  const deleteProfile = (id: string) => {
    if (profiles.length === 1) {
      alert("A família precisa de pelo menos um administrador.");
      return;
    }
    if (confirm("Deseja remover este membro da família Legado?")) {
      setProfiles(profiles.filter(p => p.id !== id));
      if (activeProfileId === id) setActiveProfileId(profiles[0].id);
      setIsProfileModalOpen(false);
    }
  };

  const addRule = () => {
    const title = prompt("Título da Regra:");
    if (!title) return;
    const description = prompt("Descrição:");
    const icon = prompt("Emoji representativo:") || '📜';
    const newRule: FamilyRule = { id: Date.now().toString(), title, description: description || '', icon };
    setRules([...rules, newRule]);
  };

  const addDuty = () => {
    const title = prompt("Qual o novo dever doméstico?");
    if (!title) return;
    const frequency = prompt("Frequência (Diária, Semanal, Mensal):") as FamilyResponsibility['frequency'];
    const assignedId = prompt("ID do Responsável (ou 'family' para todos):") || 'family';
    
    const newDuty: FamilyResponsibility = { 
      id: Date.now().toString(), 
      title, 
      frequency: ['Diária', 'Semanal', 'Mensal'].includes(frequency) ? frequency : 'Diária',
      assignedProfileId: assignedId
    };
    setResponsibilities([...responsibilities, newDuty]);
  };

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 flex flex-col shadow-2xl overflow-hidden relative border-x border-slate-200">
      
      {/* Profile Detail Modal */}
      {isProfileModalOpen && editingProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden flex flex-col animate-slideUp">
            <div className="relative h-32 bg-slate-900">
               <button onClick={() => setIsProfileModalOpen(false)} className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                 <X size={20} />
               </button>
               <div className="absolute -bottom-12 left-8">
                  <div className="relative group">
                    {editingProfile.avatar ? (
                      <img src={editingProfile.avatar} className="w-24 h-24 rounded-[32px] border-4 border-white object-cover shadow-lg" alt="Avatar" />
                    ) : (
                      <div className="w-24 h-24 rounded-[32px] border-4 border-white bg-indigo-600 flex items-center justify-center text-white text-3xl font-black shadow-lg">
                        {editingProfile.name[0]}
                      </div>
                    )}
                    <button className="absolute bottom-0 right-0 p-2 bg-indigo-600 rounded-xl text-white shadow-lg translate-x-2 translate-y-2 hover:scale-110 transition-transform">
                      <Camera size={16} />
                    </button>
                  </div>
               </div>
            </div>

            <div className="pt-16 p-8 space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nome do Membro</label>
                <input 
                  value={editingProfile.name}
                  onChange={(e) => setEditingProfile({...editingProfile, name: e.target.value})}
                  className="w-full text-xl font-black text-slate-800 outline-none p-2 bg-slate-50 rounded-2xl border border-transparent focus:border-indigo-100 transition-all"
                  placeholder="Nome Completo"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Papel</label>
                  <select 
                    value={editingProfile.role}
                    onChange={(e) => setEditingProfile({...editingProfile, role: e.target.value as any})}
                    className="w-full text-xs font-bold text-slate-800 outline-none p-3 bg-slate-50 rounded-2xl border border-transparent focus:border-indigo-100 transition-all"
                  >
                    <option value="Pai">Pai</option>
                    <option value="Mãe">Mãe</option>
                    <option value="Filho">Filho</option>
                    <option value="Filha">Filha</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Aniversário</label>
                  <div className="relative">
                    <input 
                      type="date"
                      value={editingProfile.birthday || ''}
                      onChange={(e) => setEditingProfile({...editingProfile, birthday: e.target.value})}
                      className="w-full text-xs font-bold text-slate-800 outline-none p-3 bg-slate-50 rounded-2xl border border-transparent focus:border-indigo-100 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Bio / Propósito</label>
                <textarea 
                  value={editingProfile.bio || ''}
                  onChange={(e) => setEditingProfile({...editingProfile, bio: e.target.value})}
                  className="w-full text-xs font-medium text-slate-600 outline-none p-3 bg-slate-50 rounded-2xl border border-transparent focus:border-indigo-100 transition-all min-h-[80px] resize-none"
                  placeholder="Defina o propósito deste membro..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Foto (URL)</label>
                <input 
                  value={editingProfile.avatar || ''}
                  onChange={(e) => setEditingProfile({...editingProfile, avatar: e.target.value})}
                  className="w-full text-xs font-medium text-indigo-600 outline-none p-3 bg-slate-50 rounded-2xl border border-transparent focus:border-indigo-100 transition-all"
                  placeholder="https://exemplo.com/foto.jpg"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => deleteProfile(editingProfile.id)} className="flex-1 py-4 text-xs font-black text-red-500 hover:bg-red-50 rounded-2xl transition-all">REMOVER</button>
                <button onClick={saveProfile} className="flex-[2] py-4 bg-slate-900 text-white text-xs font-black rounded-3xl shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2">
                  <Save size={16}/> SALVAR ALTERAÇÕES
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Header */}
      <header className="p-5 bg-slate-900 text-white flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div 
            onClick={() => openProfileEditor(activeProfile)}
            className="w-12 h-12 rounded-full border-2 border-indigo-500 bg-slate-800 flex items-center justify-center font-bold text-xl shadow-inner cursor-pointer overflow-hidden"
          >
            {activeProfile.avatar ? (
              <img src={activeProfile.avatar} className="w-full h-full object-cover" alt="Me" />
            ) : (
              activeProfile.name[0]
            )}
          </div>
          <div className="cursor-pointer" onClick={() => openProfileEditor(activeProfile)}>
            <h1 className="text-base font-extrabold leading-tight tracking-tight">{activeProfile.name}</h1>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{activeProfile.role} • Legado</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setView(ViewMode.AI)} className="p-2.5 bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/40 border border-indigo-400/20">
             <Sparkles size={20} />
           </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-5 pb-32">
        
        {view === ViewMode.DASHBOARD && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Estado dos Pilares</h2>
                 <Flame size={16} className="text-orange-500 animate-pulse" />
               </div>
               <div className="grid grid-cols-1 gap-4">
                 {(['Espiritual', 'Estudos', 'Saúde', 'Intelectual'] as PillarType[]).map(p => (
                   <div key={p} className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl ${PILLAR_COLORS[p]}`}>{PILLAR_ICONS[p]}</div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1 text-[11px] font-bold text-slate-700">
                          <span>{p}</span>
                          <span>75%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full bg-indigo-600 transition-all duration-1000 w-[75%]`} />
                        </div>
                      </div>
                   </div>
                 ))}
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="bg-slate-900 text-white p-5 rounded-3xl flex flex-col items-center justify-center shadow-xl">
                  <Clock size={24} className="mb-2 text-indigo-400" />
                  <span className="text-3xl font-black">{dailyStudyHours}h</span>
                  <span className="text-[10px] font-bold opacity-50 uppercase tracking-widest">Estudos Hoje</span>
               </div>
               <div className="bg-emerald-600 text-white p-5 rounded-3xl flex flex-col items-center justify-center shadow-xl">
                  <CheckSquare size={24} className="mb-2 text-emerald-200" />
                  <span className="text-3xl font-black">{dailyTasks.filter(t => t.completed).length}</span>
                  <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">Concluídos</span>
               </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Meta de Longo Prazo</h3>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-800">Eduardo do Futuro: Concursado & Próspero</span>
                <div className="flex items-center gap-3">
                   <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                      <div className="bg-gradient-to-r from-indigo-600 to-indigo-400 h-full" style={{width: '32%'}} />
                   </div>
                   <span className="text-xs font-black text-indigo-600 italic">32%</span>
                </div>
                <p className="text-[10px] text-slate-400 italic">"Disciplina diária constrói um futuro inevitável."</p>
              </div>
            </div>
          </div>
        )}

        {view === ViewMode.AGENDA && (
          <div className="space-y-4 animate-fadeIn">
             <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-100 shadow-lg mb-4">
                <button onClick={() => {
                  const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate()-1); setSelectedDate(d.toISOString().split('T')[0]);
                }} className="text-slate-400 p-1 hover:bg-slate-50 rounded-full"><ChevronLeft size={24}/></button>
                <div className="text-center">
                   <p className="text-sm font-black text-slate-800">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long'})}</p>
                   <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long'})}</p>
                </div>
                <button onClick={() => {
                  const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate()+1); setSelectedDate(d.toISOString().split('T')[0]);
                }} className="text-slate-400 p-1 hover:bg-slate-50 rounded-full"><ChevronRight size={24}/></button>
             </div>

             <div className="space-y-3">
                {dailyTasks.map(task => (
                  <div key={task.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group transition-all hover:shadow-md">
                    <div className="flex items-center gap-4">
                       <button onClick={() => toggleTask(task.id)} className={`w-6 h-6 rounded-xl border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                         {task.completed && <CheckSquare size={16} />}
                       </button>
                       <div>
                          <p className={`text-sm font-bold ${task.completed ? 'line-through text-slate-300' : 'text-slate-800'}`}>{task.title}</p>
                          <div className="flex gap-2 mt-1">
                             <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${PILLAR_COLORS[task.pillar]}`}>{task.pillar}</span>
                             {task.isFamilyTask && <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-900 text-white">Familiar</span>}
                          </div>
                       </div>
                    </div>
                    <button onClick={() => setTasks(tasks.filter(t => t.id !== task.id))} className="text-slate-200 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={18}/></button>
                  </div>
                ))}
                {dailyTasks.length === 0 && <div className="text-center py-20 text-slate-300 italic text-xs">Nenhum dever para esta data.</div>}
             </div>
          </div>
        )}

        {view === ViewMode.STUDY && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-indigo-900 text-white p-6 rounded-3xl shadow-xl">
               <div className="flex justify-between items-start mb-4">
                 <div>
                    <h2 className="text-xl font-black">Cronograma de Foco</h2>
                    <p className="text-xs opacity-60">Foco: Banco do Brasil (Concurso)</p>
                 </div>
                 <div className="bg-indigo-800 p-2 rounded-2xl"><GraduationCap size={24}/></div>
               </div>
               <div className="flex gap-2">
                  <div className="flex-1 bg-indigo-800/50 p-3 rounded-2xl text-center">
                    <p className="text-[10px] opacity-50 uppercase font-bold">Meta Diária</p>
                    <p className="text-lg font-black">8.0h</p>
                  </div>
                  <div className="flex-1 bg-indigo-800/50 p-3 rounded-2xl text-center">
                    <p className="text-[10px] opacity-50 uppercase font-bold">Líquidas</p>
                    <p className="text-lg font-black">{dailyStudyHours}h</p>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Matérias Prioritárias</h3>
               {[
                 { subject: 'Português', time: '07:00 - 09:00', icon: <BookOpen size={14}/> },
                 { subject: 'Conhecimentos Bancários', time: '09:15 - 11:15', icon: <Briefcase size={14}/> },
                 { subject: 'Informática / TI', time: '13:30 - 15:30', icon: <LayoutDashboard size={14}/> }
               ].map((item, idx) => (
                 <div key={idx} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <div className="p-2 bg-slate-50 text-slate-500 rounded-xl">{item.icon}</div>
                       <div>
                          <p className="text-sm font-bold text-slate-800">{item.subject}</p>
                          <p className="text-[10px] text-indigo-500 font-bold">{item.time}</p>
                       </div>
                    </div>
                    <button className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full uppercase transition-colors hover:bg-indigo-100">Iniciar</button>
                 </div>
               ))}
            </div>
          </div>
        )}

        {view === ViewMode.GOALS && (
          <div className="space-y-6 animate-fadeIn">
            {['Curto', 'Médio', 'Longo'].map(type => (
              <div key={type}>
                <div className="flex justify-between items-center mb-3 px-1 border-b border-slate-200 pb-1">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{type} Prazo</h3>
                  <span className="text-[10px] text-slate-300">{type === 'Curto' ? '90 Dias' : type === 'Médio' ? '1-3 Anos' : '10+ Anos'}</span>
                </div>
                <div className="space-y-3">
                  {activeGoals.filter(g => g.type === type).map(g => (
                    <div key={g.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm group">
                      <div className="flex justify-between items-center mb-3">
                         <span className="text-sm font-bold text-slate-800">{g.title}</span>
                         <div className="flex items-center gap-2">
                            <button onClick={() => setGoals(goals.filter(item => item.id !== g.id))} className="p-1.5 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                            <div className={`p-1.5 rounded-lg ${PILLAR_COLORS[g.pillar]}`}>{PILLAR_ICONS[g.pillar]}</div>
                         </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{width: `${g.progress}%`}} />
                      </div>
                      <div className="flex justify-between mt-2">
                        <span className="text-[10px] text-slate-400 font-bold">Progresso: {g.progress}%</span>
                        <span className="text-[10px] text-indigo-500 font-black">Meta {g.pillar}</span>
                      </div>
                    </div>
                  ))}
                  {activeGoals.filter(g => g.type === type).length === 0 && (
                     <button 
                       onClick={() => {
                         const title = prompt(`Nova meta de ${type} prazo:`);
                         if (!title) return;
                         setGoals([...goals, {
                           id: Date.now().toString(),
                           title,
                           pillar: 'Intelectual',
                           deadline: '2025-12-31',
                           type: type as any,
                           progress: 0,
                           profileId: activeProfileId
                         }]);
                       }}
                       className="w-full py-6 border-2 border-dashed border-slate-200 rounded-3xl text-[10px] font-bold text-slate-400 hover:bg-slate-100 transition-colors uppercase tracking-widest"
                     >
                       + Definir Meta {type} Prazo
                     </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === ViewMode.FAMILY && (
          <div className="space-y-6 animate-fadeIn">
             {/* Family Tabs */}
             <div className="flex bg-slate-200/50 p-1 rounded-2xl gap-1">
                {(['members', 'rules', 'duties'] as const).map(tab => (
                   <button 
                     key={tab}
                     onClick={() => setFamilySubView(tab)}
                     className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${familySubView === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-500'}`}
                   >
                      {tab === 'members' ? 'Membros' : tab === 'rules' ? 'Constituição' : 'Deveres'}
                   </button>
                ))}
             </div>

             {familySubView === 'members' && (
                <div className="space-y-6">
                   <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                      <div className="absolute -top-10 -right-10 bg-indigo-500 w-48 h-48 rounded-full opacity-10 animate-pulse" />
                      <Users size={32} className="text-indigo-400 mb-4" />
                      <h2 className="text-2xl font-black tracking-tight">Família Legado</h2>
                      <p className="text-xs text-slate-400 mt-2 italic leading-relaxed">
                        "Onde a disciplina de um constrói a fortaleza de todos."
                      </p>
                      <div className="mt-6 flex -space-x-3 overflow-hidden">
                        {profiles.map(p => (
                          <div key={p.id} className="inline-block h-10 w-10 rounded-full ring-4 ring-slate-900 overflow-hidden bg-indigo-600 flex items-center justify-center font-bold border border-indigo-400/30">
                            {p.avatar ? <img src={p.avatar} className="h-full w-full object-cover" /> : p.name[0]}
                          </div>
                        ))}
                      </div>
                   </div>

                   <div className="grid grid-cols-1 gap-4">
                      {profiles.map(p => (
                        <div 
                          key={p.id} 
                          className={`p-6 rounded-[32px] border-2 transition-all group relative overflow-hidden flex items-center gap-5 ${p.id === activeProfileId ? 'border-indigo-600 bg-white shadow-xl' : 'border-slate-100 bg-white shadow-sm hover:border-slate-200'}`}
                        >
                           <div 
                             onClick={() => setActiveProfileId(p.id)}
                             className="cursor-pointer relative shrink-0"
                           >
                              {p.avatar ? (
                                <img src={p.avatar} className="w-20 h-20 rounded-[28px] object-cover shadow-md group-hover:scale-105 transition-transform" />
                              ) : (
                                <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center font-black text-3xl shadow-md ${p.id === activeProfileId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                  {p.name[0]}
                                </div>
                              )}
                              {p.id === activeProfileId && (
                                <div className="absolute -bottom-1 -right-1 p-1.5 bg-indigo-600 rounded-full border-4 border-white text-white">
                                  <ShieldCheck size={12} />
                                </div>
                              )}
                           </div>
                           <div className="flex-1">
                              <div className="flex justify-between items-start">
                                 <div onClick={() => setActiveProfileId(p.id)} className="cursor-pointer">
                                    <h3 className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{p.name}</h3>
                                    <p className="text-[10px] uppercase font-black text-indigo-500 tracking-widest">{p.role}</p>
                                 </div>
                                 <button 
                                   onClick={() => openProfileEditor(p)}
                                   className="p-2 bg-slate-50 rounded-xl text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all opacity-0 group-hover:opacity-100"
                                 >
                                   <Edit3 size={18}/>
                                 </button>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 italic">{p.bio || "Sem descrição definida."}</p>
                              {p.birthday && (
                                <div className="flex items-center gap-1.5 mt-3 text-slate-400">
                                   <Cake size={12} />
                                   <span className="text-[10px] font-bold">{new Date(p.birthday).toLocaleDateString('pt-BR')}</span>
                                </div>
                              )}
                           </div>
                        </div>
                      ))}
                      <button 
                        onClick={addProfile}
                        className="p-8 rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 hover:bg-slate-100 transition-all text-slate-400 group"
                      >
                        <UserPlus size={32} className="group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-black uppercase tracking-widest">Acrescentar ao Legado</span>
                      </button>
                   </div>
                </div>
             )}

             {familySubView === 'rules' && (
                <div className="space-y-4">
                   <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl border border-slate-800">
                      <div className="flex items-center gap-3 mb-4">
                        <Gavel className="text-indigo-400" size={24} />
                        <h2 className="text-lg font-black tracking-tight">Regras da Casa</h2>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed italic">
                        "Estes pactos definem a ordem de nosso lar. Sem regras claras, a confusão se instala."
                      </p>
                   </div>

                   <div className="space-y-3">
                      {rules.map(rule => (
                        <div key={rule.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex gap-4 group transition-all hover:shadow-md">
                           <span className="text-2xl pt-1">{rule.icon}</span>
                           <div className="flex-1">
                              <div className="flex justify-between items-start">
                                 <h3 className="text-sm font-bold text-slate-800">{rule.title}</h3>
                                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => {
                                      const newT = prompt("Novo título:", rule.title);
                                      if (newT) setRules(rules.map(r => r.id === rule.id ? {...r, title: newT} : r));
                                    }} className="p-1 text-slate-300 hover:text-indigo-600"><Edit3 size={14}/></button>
                                    <button onClick={() => {
                                       if(confirm("Remover regra?")) setRules(rules.filter(r => r.id !== rule.id));
                                    }} className="p-1 text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                                 </div>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1 leading-snug">{rule.description}</p>
                           </div>
                        </div>
                      ))}
                   </div>

                   <button 
                     onClick={addRule}
                     className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-100 transition-colors"
                   >
                      + Adicionar Novo Pacto
                   </button>
                </div>
             )}

             {familySubView === 'duties' && (
                <div className="space-y-4">
                   <div className="bg-emerald-700 text-white p-6 rounded-3xl shadow-xl border border-emerald-600">
                      <div className="flex items-center gap-3 mb-2">
                        <ListChecks className="text-emerald-200" size={24} />
                        <h2 className="text-lg font-black tracking-tight">Matriz de Deveres</h2>
                      </div>
                      <p className="text-[11px] text-emerald-100/70">
                        Divisão clara de responsabilidades domésticas para manter a ordem do lar.
                      </p>
                   </div>

                   <div className="space-y-3">
                      {responsibilities.map(res => {
                        const assignedTo = profiles.find(p => p.id === res.assignedProfileId);
                        const isGlobal = res.assignedProfileId === 'family';
                        
                        return (
                          <div key={res.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group transition-all hover:shadow-md">
                             <div className="flex-1">
                                <h3 className="text-sm font-bold text-slate-800">{res.title}</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                   <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">{res.frequency}</span>
                                   <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${isGlobal ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                      {isGlobal ? 'Família Inteira' : `Resp: ${assignedTo?.name || 'Inexistente'}`}
                                   </span>
                                </div>
                             </div>
                             <div className="flex items-center gap-3">
                                <button onClick={() => {
                                   if(confirm("Remover dever?")) setResponsibilities(responsibilities.filter(r => r.id !== res.id));
                                }} className="p-2 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shadow-sm border ${isGlobal ? 'bg-slate-900 text-white border-slate-800' : 'bg-slate-50 text-slate-400 border-slate-100 overflow-hidden'}`}>
                                   {isGlobal ? <Users size={16}/> : (assignedTo?.avatar ? <img src={assignedTo.avatar} className="w-full h-full object-cover" /> : (assignedTo?.name[0] || '?'))}
                                </div>
                             </div>
                          </div>
                        );
                      })}
                   </div>

                   <button 
                     onClick={addDuty}
                     className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:bg-slate-100 transition-colors"
                   >
                      + Designar Novo Dever
                   </button>
                </div>
             )}
          </div>
        )}

        {view === ViewMode.AI && (
          <div className="flex flex-col h-full space-y-5 animate-fadeIn">
             {aiChat.length === 0 && (
               <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5"><Sparkles size={120}/></div>
                 <h2 className="text-2xl font-black mb-3">Mentor de Disciplina</h2>
                 <p className="text-sm text-slate-400 leading-relaxed mb-8">
                   "A ordem é a primeira lei do céu." <br/> Como estruturamos sua ordem hoje, {activeProfile.name.split(' ')[0]}?
                 </p>
                 <div className="space-y-2">
                    {["Resuma meu dia", "Como melhorar a ordem familiar?", "Sugira um pacto para a casa"].map(q => (
                      <button key={q} onClick={() => setInputText(q)} className="w-full text-left text-[11px] font-bold bg-slate-800 p-3 rounded-2xl hover:bg-indigo-600 transition-all text-slate-300">
                        {q}
                      </button>
                    ))}
                 </div>
               </div>
             )}
             <div className="flex flex-col gap-4">
                {aiChat.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed shadow-lg ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isAiLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white px-5 py-3 rounded-3xl shadow-sm border border-slate-100 flex gap-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                )}
             </div>
          </div>
        )}
      </main>

      {/* Persistent Global Input Bar */}
      <div className="absolute bottom-24 left-0 right-0 px-6 pointer-events-none z-50">
        <form onSubmit={handleSmartInput} className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl rounded-[32px] flex items-center p-2 overflow-hidden ring-8 ring-slate-50/50 transition-all hover:ring-indigo-100/50 focus-within:ring-indigo-200/50">
          <input 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={view === ViewMode.AI ? "Consulte o Mentor..." : "Adicionar dever ou estudo..."}
            className="flex-1 bg-transparent px-5 py-3 outline-none text-sm font-medium text-slate-800 placeholder:text-slate-400"
          />
          <button type="submit" className="w-12 h-12 flex items-center justify-center bg-slate-900 text-white rounded-full hover:bg-black transition-all shadow-xl active:scale-95">
            {isAiLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      </div>

      {/* Dock-style Bottom Navigation */}
      <nav className="fixed bottom-0 max-w-md w-full bg-white/90 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center px-4 py-4 z-[60]">
        <NavButton active={view === ViewMode.DASHBOARD} onClick={() => setView(ViewMode.DASHBOARD)} icon={<LayoutDashboard size={22}/>} label="Início" />
        <NavButton active={view === ViewMode.AGENDA} onClick={() => setView(ViewMode.AGENDA)} icon={<Calendar size={22}/>} label="Agenda" />
        
        <div className="flex justify-center -mt-12">
          <button 
            onClick={() => setView(ViewMode.AI)}
            className={`w-16 h-16 rounded-[24px] shadow-2xl flex items-center justify-center transition-all ${view === ViewMode.AI ? 'bg-indigo-600 text-white scale-110' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            <Sparkles size={28} />
          </button>
        </div>

        <NavButton active={view === ViewMode.GOALS} onClick={() => setView(ViewMode.GOALS)} icon={<Target size={22}/>} label="Metas" />
        <NavButton active={view === ViewMode.FAMILY} onClick={() => setView(ViewMode.FAMILY)} icon={<Users size={22}/>} label="Família" />
      </nav>
    </div>
  );
};

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1.5 transition-all ${active ? 'text-indigo-600 font-black' : 'text-slate-400 hover:text-slate-600'}`}
  >
    <div className={`transition-all ${active ? 'scale-110' : 'scale-100'}`}>{icon}</div>
    <span className={`text-[8px] font-black uppercase tracking-tighter ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
  </button>
);

export default App;
