import React, { useState } from 'react';
import { Competition, Command, Penalty, Team, Event } from '../types';
import { Plus, Trash2, Save, Trophy, Settings, Users, ClipboardList, CheckSquare } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';

interface AdminDashboardProps {
  competitions: Competition[];
  loading: boolean;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ competitions, loading }) => {
  const [selectedComp, setSelectedComp] = useState<Competition | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [isCreatingComp, setIsCreatingComp] = useState(false);
  const [newCompName, setNewCompName] = useState('');
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const handleCreateComp = async () => {
    if (!newCompName.trim()) return;
    const date = new Date().toISOString().split('T')[0];
    const id = uuidv4();

    try {
      const newComp: Competition = {
        id,
        name: newCompName,
        date,
        pin: Math.floor(1000 + Math.random() * 9000).toString(),
        events: [],
        teams: []
      };
      await setDoc(doc(db, 'competitions', id), newComp);
      setSelectedComp(newComp);
      setIsCreatingComp(false);
      setNewCompName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'competitions');
    }
  };

  const saveCompetition = async () => {
    if (!selectedComp) return;
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await setDoc(doc(db, 'competitions', selectedComp.id), selectedComp);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `competitions/${selectedComp.id}`);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteComp = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this competition?')) return;
    try {
      await deleteDoc(doc(db, 'competitions', id));
      if (selectedComp?.id === id) setSelectedComp(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `competitions/${id}`);
    }
  };

  const handleAddEvent = () => {
    if (!selectedComp || !newEventName.trim()) return;
    const newEvent: Event = {
      id: uuidv4(),
      name: newEventName,
      commands: [],
      penalties: [],
      enrolledTeamIds: []
    };
    setSelectedComp({ ...selectedComp, events: [...(selectedComp.events || []).filter(Boolean), newEvent] });
    setSelectedEventId(newEvent.id);
    setIsAddingEvent(false);
    setNewEventName('');
  };

  const removeEvent = (id: string) => {
    if (!selectedComp) return;
    setSelectedComp({ ...selectedComp, events: (selectedComp.events || []).filter(e => e && e.id !== id) });
    if (selectedEventId === id) setSelectedEventId(null);
  };

  const updateEvent = (id: string, updates: Partial<Event>) => {
    if (!selectedComp) return;
    setSelectedComp({
      ...selectedComp,
      events: (selectedComp.events || []).map(e => (e && e.id === id) ? { ...e, ...updates } : e)
    });
  };

  const addCommand = () => {
    const events = Array.isArray(selectedComp?.events) ? selectedComp.events : [];
    const event = events.find(e => e && e.id === selectedEventId);
    if (!event) return;
    const newCmd: Command = { id: uuidv4(), text: "New Command", maxPoints: 10 };
    updateEvent(selectedEventId!, {
      commands: [...(event.commands || []).filter(Boolean), newCmd]
    });
  };

  const removeCommand = (id: string) => {
    if (!selectedComp || !selectedEventId) return;
    const event = (selectedComp.events || []).find(e => e && e.id === selectedEventId);
    if (!event) return;
    updateEvent(selectedEventId, {
      commands: (event.commands || []).filter(c => c && c.id !== id)
    });
  };

  const updateCommand = (id: string, updates: Partial<Command>) => {
    if (!selectedComp || !selectedEventId) return;
    const event = (selectedComp.events || []).find(e => e && e.id === selectedEventId);
    if (!event) return;
    updateEvent(selectedEventId, {
      commands: (event.commands || []).map(c => (c && c.id === id) ? { ...c, ...updates } : c)
    });
  };

  const addPenalty = () => {
    const events = Array.isArray(selectedComp?.events) ? selectedComp.events : [];
    const event = events.find(e => e && e.id === selectedEventId);
    if (!event) return;
    const newPenalty: Penalty = { id: uuidv4(), name: "New Penalty", deduction: 5 };
    updateEvent(selectedEventId!, {
      penalties: [...(event.penalties || []).filter(Boolean), newPenalty]
    });
  };

  const removePenalty = (id: string) => {
    if (!selectedComp || !selectedEventId) return;
    const event = (selectedComp.events || []).find(e => e && e.id === selectedEventId);
    if (!event) return;
    updateEvent(selectedEventId, {
      penalties: (event.penalties || []).filter(p => p && p.id !== id)
    });
  };

  const updatePenalty = (id: string, updates: Partial<Penalty>) => {
    if (!selectedComp || !selectedEventId) return;
    const event = (selectedComp.events || []).find(e => e && e.id === selectedEventId);
    if (!event) return;
    updateEvent(selectedEventId, {
      penalties: (event.penalties || []).map(p => (p && p.id === id) ? { ...p, ...updates } : p)
    });
  };

  const toggleTeamEnrollment = (teamId: string) => {
    if (!selectedComp || !selectedEventId) return;
    const event = (Array.isArray(selectedComp.events) ? selectedComp.events : []).find(e => e && e.id === selectedEventId);
    if (!event) return;
    const enrolled = (Array.isArray(event.enrolledTeamIds) ? event.enrolledTeamIds : []).includes(teamId);
    updateEvent(selectedEventId, {
      enrolledTeamIds: enrolled 
        ? (Array.isArray(event.enrolledTeamIds) ? event.enrolledTeamIds : []).filter(id => id !== teamId)
        : [...(Array.isArray(event.enrolledTeamIds) ? event.enrolledTeamIds : []), teamId]
    });
  };

  const addTeam = () => {
    if (!selectedComp) return;
    const newTeam: Team = { id: uuidv4(), schoolName: "New School", teamName: "New Team", division: "Unarmed" };
    setSelectedComp({ ...selectedComp, teams: [...(selectedComp.teams || []).filter(Boolean), newTeam] });
  };

  const removeTeam = (id: string) => {
    if (!selectedComp) return;
    setSelectedComp({ 
      ...selectedComp, 
      teams: (selectedComp.teams || []).filter(t => t && t.id !== id),
      events: (selectedComp.events || []).map(e => e ? ({
        ...e,
        enrolledTeamIds: (e.enrolledTeamIds || []).filter(tid => tid !== id)
      }) : e)
    });
  };

  const updateTeam = (id: string, updates: Partial<Team>) => {
    if (!selectedComp) return;
    setSelectedComp({
      ...selectedComp,
      teams: (selectedComp.teams || []).map(t => (t && t.id === id) ? { ...t, ...updates } : t)
    });
  };

  const selectedEvent = (selectedComp?.events || []).find(e => e && e.id === selectedEventId);

  if (loading) return <div className="p-8 font-mono">LOADING_SYSTEM_DATA...</div>;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-zinc-900 text-zinc-400 p-4 flex flex-col gap-4 border-r border-zinc-800">
        <div className="flex items-center gap-2 text-white font-bold mb-4">
          <Trophy size={20} className="text-orange-500" />
          <span>DRILLMASTER_PRO</span>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest mb-2 opacity-50">Competitions</div>
          {(competitions || []).map(comp => comp ? (
            <div key={comp.id} className="flex items-center group">
              <button
                onClick={() => { setSelectedComp(comp); setSelectedEventId(null); }}
                className={`flex-1 text-left px-3 py-2 rounded text-sm mb-1 transition-colors ${selectedComp?.id === comp.id ? 'bg-zinc-800 text-white' : 'hover:bg-zinc-800'}`}
              >
                {comp.name}
              </button>
              <button 
                onClick={() => handleDeleteComp(comp.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-zinc-600 hover:text-red-500 transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ) : null)}
          
          {isCreatingComp ? (
            <div className="p-2 bg-zinc-800 rounded mt-2 border border-zinc-700">
              <input 
                autoFocus
                value={newCompName}
                onChange={(e) => setNewCompName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateComp();
                  if (e.key === 'Escape') setIsCreatingComp(false);
                }}
                placeholder="Competition Name..."
                className="w-full bg-zinc-900 border border-zinc-700 text-white text-xs p-2 rounded outline-none focus:border-orange-500"
              />
              <div className="flex gap-2 mt-2">
                <button onClick={handleCreateComp} className="flex-1 bg-orange-600 text-white text-[10px] py-1.5 rounded font-bold hover:bg-orange-500 transition-colors">CREATE</button>
                <button onClick={() => setIsCreatingComp(false)} className="flex-1 bg-zinc-700 text-white text-[10px] py-1.5 rounded hover:bg-zinc-600 transition-colors">CANCEL</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingComp(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-orange-500 hover:bg-orange-500/10 hover:text-orange-400 rounded transition-all mt-2 font-medium border border-orange-500/20 bg-orange-500/5 group"
            >
              <Plus size={16} className="group-hover:scale-110 transition-transform" /> New Competition
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-[#E4E3E0] p-8">
        {selectedComp ? (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 uppercase">{selectedComp.name}</h1>
                <div className="flex gap-4 mt-2 text-sm font-mono">
                  <span className="bg-orange-100 text-orange-800 px-2 py-0.5 rounded font-bold">PIN: {selectedComp.pin}</span>
                  <span className="text-zinc-500">DATE: {selectedComp.date}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {saveStatus === 'success' && <span className="text-green-600 text-xs font-bold animate-pulse">CHANGES_PERSISTED_SUCCESSFULLY</span>}
                {saveStatus === 'error' && <span className="text-red-600 text-xs font-bold">SAVE_FAILED_RETRY</span>}
                <button 
                  onClick={saveCompetition}
                  disabled={isSaving}
                  className={`flex items-center gap-2 px-4 py-2 rounded transition-all shadow-sm ${
                    isSaving ? 'bg-zinc-400 cursor-not-allowed' : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                  }`}
                >
                  <Save size={18} className={isSaving ? 'animate-spin' : ''} /> 
                  {isSaving ? 'SAVING...' : 'SAVE_CHANGES'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Event List */}
              <div className="lg:col-span-1 space-y-6">
                <section className="bg-white tech-grid rounded-lg overflow-hidden shadow-sm">
                  <div className="tech-header flex justify-between items-center">
                    <span>EVENTS</span>
                    {!isAddingEvent && (
                      <button onClick={() => setIsAddingEvent(true)} className="text-zinc-900 hover:text-orange-600">
                        <Plus size={16}/>
                      </button>
                    )}
                  </div>
                  
                  {isAddingEvent && (
                    <div className="p-3 bg-zinc-50 border-b border-zinc-100">
                      <input 
                        autoFocus
                        value={newEventName}
                        onChange={(e) => setNewEventName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddEvent();
                          if (e.key === 'Escape') setIsAddingEvent(false);
                        }}
                        placeholder="Event Name..."
                        className="w-full bg-white border border-zinc-200 text-xs p-2 rounded outline-none focus:border-orange-500 mb-2"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleAddEvent} className="flex-1 bg-zinc-900 text-white text-[10px] py-1.5 rounded font-bold hover:bg-zinc-800 transition-colors uppercase">ADD_EVENT</button>
                        <button onClick={() => setIsAddingEvent(false)} className="flex-1 bg-zinc-200 text-zinc-600 text-[10px] py-1.5 rounded hover:bg-zinc-300 transition-colors uppercase">CANCEL</button>
                      </div>
                    </div>
                  )}

                  <div className="max-h-[400px] overflow-y-auto">
                    {(selectedComp.events || []).map(event => event ? (
                      <div 
                        key={event.id} 
                        onClick={() => setSelectedEventId(event.id)}
                        className={`p-3 flex justify-between items-center cursor-pointer border-b border-zinc-100 transition-colors ${selectedEventId === event.id ? 'bg-zinc-100' : 'hover:bg-zinc-50'}`}
                      >
                        <span className="text-sm font-bold">{event.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeEvent(event.id); }} className="text-zinc-400 hover:text-red-500">
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ) : null)}
                  </div>
                </section>

                {/* Global Team Roster */}
                <section className="bg-white tech-grid rounded-lg overflow-hidden shadow-sm">
                  <div className="tech-header flex justify-between items-center">
                    <span>MASTER_TEAM_LIST</span>
                    <button onClick={addTeam} className="text-zinc-900 hover:text-orange-600"><Plus size={16}/></button>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {(selectedComp.teams || []).map((team) => team ? (
                      <div key={team.id} className="tech-row p-3 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <input 
                            value={team.schoolName}
                            onChange={(e) => updateTeam(team.id, { schoolName: e.target.value })}
                            className="bg-transparent border-none focus:ring-0 text-sm font-bold p-0 w-full"
                          />
                          <button onClick={() => removeTeam(team.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                        </div>
                        <input 
                          value={team.teamName}
                          onChange={(e) => updateTeam(team.id, { teamName: e.target.value })}
                          className="bg-transparent border-none focus:ring-0 text-xs p-0 opacity-60"
                        />
                      </div>
                    ) : null)}
                  </div>
                </section>
              </div>

              {/* Event Details Editor */}
              <div className="lg:col-span-3 space-y-8">
                {selectedEvent ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Command Editor */}
                    <section className="bg-white tech-grid rounded-lg overflow-hidden shadow-sm">
                      <div className="tech-header flex justify-between items-center bg-zinc-50">
                        <span className="flex items-center gap-2"><ClipboardList size={14}/> {selectedEvent.name} - COMMANDS</span>
                        <button onClick={addCommand} className="text-zinc-900 hover:text-orange-600"><Plus size={16}/></button>
                      </div>
                      <div className="max-h-[500px] overflow-y-auto">
                        {(selectedEvent.commands || []).map((cmd, index) => cmd ? (
                          <div key={cmd.id} className="tech-row p-3 flex items-center gap-3">
                            <span className="tech-value text-xs opacity-50 w-6">{index + 1}.</span>
                            <input 
                              value={cmd.text}
                              onChange={(e) => updateCommand(cmd.id, { text: e.target.value })}
                              className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium"
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] opacity-50">PTS:</span>
                              <input 
                                type="number"
                                value={cmd.maxPoints}
                                onChange={(e) => updateCommand(cmd.id, { maxPoints: parseInt(e.target.value) || 0 })}
                                className="w-12 bg-zinc-100 border-none text-xs text-center rounded p-1 font-mono"
                              />
                            </div>
                            <button onClick={() => removeCommand(cmd.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                          </div>
                        ) : null)}
                      </div>
                    </section>

                    <div className="space-y-8">
                      {/* Enrollment */}
                      <section className="bg-white tech-grid rounded-lg overflow-hidden shadow-sm">
                        <div className="tech-header bg-zinc-50">
                          <span className="flex items-center gap-2"><Users size={14}/> TEAM_ENROLLMENT</span>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {(selectedComp.teams || []).map(team => team ? (
                            <div 
                              key={team.id} 
                              onClick={() => toggleTeamEnrollment(team.id)}
                              className="p-3 flex items-center justify-between cursor-pointer hover:bg-zinc-50 border-b border-zinc-100"
                            >
                              <div className="text-xs">
                                <div className="font-bold">{team.schoolName}</div>
                                <div className="opacity-60">{team.teamName}</div>
                              </div>
                              {(selectedEvent.enrolledTeamIds || []).includes(team.id) ? (
                                <CheckSquare size={16} className="text-orange-600" />
                              ) : (
                                <div className="w-4 h-4 border border-zinc-300 rounded"></div>
                              )}
                            </div>
                          ) : null)}
                        </div>
                      </section>

                      {/* Penalties */}
                      <section className="bg-white tech-grid rounded-lg overflow-hidden shadow-sm">
                        <div className="tech-header flex justify-between items-center bg-zinc-50">
                          <span>PENALTIES</span>
                          <button onClick={addPenalty} className="text-zinc-900 hover:text-orange-600"><Plus size={16}/></button>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {(selectedEvent.penalties || []).map((p) => p ? (
                            <div key={p.id} className="tech-row p-3 flex items-center gap-3">
                              <input 
                                value={p.name}
                                onChange={(e) => updatePenalty(p.id, { name: e.target.value })}
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm"
                              />
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] opacity-50">DEDUCT:</span>
                                <input 
                                  type="number"
                                  value={p.deduction}
                                  onChange={(e) => updatePenalty(p.id, { deduction: parseInt(e.target.value) || 0 })}
                                  className="w-12 bg-zinc-100 border-none text-xs text-center rounded p-1 font-mono"
                                />
                              </div>
                              <button onClick={() => removePenalty(p.id)} className="text-zinc-400 hover:text-red-500"><Trash2 size={14}/></button>
                            </div>
                          ) : null)}
                        </div>
                      </section>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-300 rounded-xl">
                    <ClipboardList size={48} className="mb-4 opacity-20" />
                    <p className="text-sm uppercase tracking-widest">Select an event to configure its scoresheet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-zinc-400">
            <Settings size={48} className="mb-4 opacity-20" />
            <p className="text-sm uppercase tracking-widest">Select or create a competition to begin</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
