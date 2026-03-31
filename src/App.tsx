import React, { useState, useEffect, createContext, useContext } from 'react';
import AdminDashboard from './components/AdminDashboard';
import PrintableScoresheet from './components/PrintableScoresheet';
import { Competition, Team } from './types';
import { LayoutDashboard, Printer, Menu, X, LogIn, LogOut, Trophy } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, onSnapshot, query, getDoc, doc } from 'firebase/firestore';

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}
const AuthContext = createContext<AuthContextType>({ user: null, isAdmin: false, loading: true });
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [view, setView] = useState<'admin' | 'print' | 'judge'>('admin');
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompForPrint, setSelectedCompForPrint] = useState<Competition | null>(null);
  const [selectedEventIdForPrint, setSelectedEventIdForPrint] = useState<string>('');
  const [selectedTeamIdForPrint, setSelectedTeamIdForPrint] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');

  // --- Auth Listener ---
  useEffect(() => {
    // Fully bypassed as requested - set a mock user and admin state
    setUser({ uid: 'mock_user', email: 'fyre562@gmail.com', displayName: 'Admin' } as any);
    setIsAdmin(true);
    setAuthLoading(false);
  }, []);

  // --- Firestore Listener ---
  useEffect(() => {
    if (authLoading) return;

    setLoading(true);
    const q = query(collection(db, 'competitions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Competition));
      setCompetitions(data);
      setLoading(false);
      
      if (selectedCompForPrint) {
        const updated = data.find(c => c.id === selectedCompForPrint.id);
        if (updated) setSelectedCompForPrint(updated);
      }

      if (data.length > 0 && !selectedCompForPrint) {
        setSelectedCompForPrint(data[0]);
        if (data[0].events && data[0].events.length > 0) {
          setSelectedEventIdForPrint(data[0].events[0].id);
          if (data[0].events[0].enrolledTeamIds && data[0].events[0].enrolledTeamIds.length > 0) {
            setSelectedTeamIdForPrint(data[0].events[0].enrolledTeamIds[0]);
          }
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'competitions');
      setLoading(false);
    });

    return unsubscribe;
  }, [authLoading]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    // Mock logout
    alert('Logout disabled in bypass mode');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center text-white font-mono uppercase tracking-[0.2em]">
        Initializing_System...
      </div>
    );
  }

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (pin.length !== 4) {
      setPinError('PIN must be 4 digits');
      return;
    }
    
    try {
      // Authentication is bypassed, user is already mocked
      
      // The listener will now trigger and populate competitions
      // We'll wait a bit for the data to arrive or check the current state
      // Since onSnapshot is active, we might need to wait or use a one-time fetch
      const { getDocs, query, collection, where } = await import('firebase/firestore');
      const q = query(collection(db, 'competitions'), where('pin', '==', pin));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const comp = { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Competition;
        setSelectedCompForPrint(comp);
        setView('judge');
      } else {
        setPinError('Invalid PIN');
      }
    } catch (err) {
      console.error(err);
      setPinError('Authentication failed');
    }
  };

  const selectedEventForPrint = selectedCompForPrint?.events?.find(e => e.id === selectedEventIdForPrint);
  const enrolledTeamsForPrint = selectedEventForPrint 
    ? selectedCompForPrint?.teams?.filter(t => selectedEventForPrint.enrolledTeamIds?.includes(t.id)) || []
    : [];
  const selectedTeamForPrint = selectedCompForPrint?.teams?.find(t => t.id === selectedTeamIdForPrint);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading: authLoading }}>
      <div className="min-h-screen flex flex-col">
        {/* Navigation Header */}
        <nav className="bg-zinc-900 text-white p-4 flex justify-between items-center no-print sticky top-0 z-50">
          <div className="flex items-center gap-2 font-bold tracking-tighter text-xl">
            <span className="bg-orange-600 px-1 rounded">D</span>RILLMASTER
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex gap-6 items-center">
            <button 
              onClick={() => setView('admin')}
              className={`flex items-center gap-2 text-sm uppercase tracking-widest transition-colors ${view === 'admin' ? 'text-orange-500' : 'hover:text-orange-400'}`}
            >
              <LayoutDashboard size={16} /> Admin
            </button>
            <button 
              onClick={() => setView('print')}
              className={`flex items-center gap-2 text-sm uppercase tracking-widest transition-colors ${view === 'print' ? 'text-orange-500' : 'hover:text-orange-400'}`}
            >
              <Printer size={16} /> Print Sheets
            </button>

            <button 
              onClick={() => {
                const url = "https://ais-pre-odoqbwqpzqwjzd2kggf3ru-340193788130.us-west2.run.app";
                alert(`MOBILE CONNECTION GUIDE:\n\n1. Open your mobile app settings.\n2. Set Server URL to:\n${url}\n\n3. TROUBLESHOOTING "COOKIE_REQUIRED":\n   - In AI Studio, click "Share" (top right).\n   - Set visibility to "Anyone with the link can view".\n   - Click "Save".\n   - Open the URL above in your mobile browser ONCE to clear the "Continue to App" screen.\n\n4. DO NOT use the "ais-dev" URL.`);
              }}
              className="flex items-center gap-2 text-sm uppercase tracking-widest text-orange-500 border border-orange-500/30 px-3 py-1 rounded hover:bg-orange-500/10 transition-colors"
            >
              Connect Mobile
            </button>
            
            <div className="h-6 w-px bg-zinc-700 mx-2"></div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest opacity-50">Authenticated as</div>
                <div className="text-xs font-bold">{user.displayName || user.email}</div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-zinc-800 text-white p-4 flex flex-col gap-4 no-print border-b border-zinc-700">
            <button onClick={() => { setView('admin'); setIsMenuOpen(false); }} className="text-left uppercase tracking-widest text-sm py-2">Admin Dashboard</button>
            <button onClick={() => { setView('print'); setIsMenuOpen(false); }} className="text-left uppercase tracking-widest text-sm py-2">Print Sheets</button>
            <button onClick={handleLogout} className="text-left uppercase tracking-widest text-sm py-2 text-red-400">Logout</button>
          </div>
        )}

        {/* View Content */}
        <main className="flex-1">
          {view === 'admin' && (
            <AdminDashboard 
              competitions={competitions} 
              loading={loading} 
            />
          )}
          {view === 'judge' && (
            <div className="max-w-4xl mx-auto p-4 md:p-8">
              <div className="flex justify-between items-center mb-8 pb-4 border-b-2 border-zinc-900">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase italic">{selectedCompForPrint?.name}</h2>
                  <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Judge Access Portal • {selectedCompForPrint?.date}</p>
                </div>
                <button 
                  onClick={() => setView('admin')}
                  className="bg-zinc-900 text-white px-4 py-2 rounded font-bold uppercase text-xs tracking-widest hover:bg-zinc-800"
                >
                  Exit
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedCompForPrint?.events.map(event => (
                  <div key={event.id} className="bg-white border-2 border-zinc-900 p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="text-xl font-bold mb-4 uppercase tracking-tight">{event.name}</h3>
                    <div className="space-y-2">
                      {event.enrolledTeamIds.map(teamId => {
                        const team = selectedCompForPrint.teams.find(t => t.id === teamId);
                        if (!team) return null;
                        return (
                          <button
                            key={teamId}
                            onClick={() => {
                              setSelectedEventIdForPrint(event.id);
                              setSelectedTeamIdForPrint(teamId);
                              setView('print');
                            }}
                            className="w-full text-left p-3 border border-zinc-200 hover:border-orange-500 hover:bg-orange-50 transition-all flex justify-between items-center group"
                          >
                            <div>
                              <p className="font-bold text-sm uppercase">{team.schoolName}</p>
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{team.teamName} • {team.division}</p>
                            </div>
                            <Printer size={16} className="text-zinc-300 group-hover:text-orange-500" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {view === 'print' && (
            <div className="p-8 bg-[#E4E3E0] min-h-full">
              <div className="max-w-4xl mx-auto mb-8 bg-white p-6 tech-grid rounded shadow-sm no-print">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="tech-header p-0 border-none m-0">Print Configuration</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1">Competition</label>
                    <select 
                      className="w-full bg-zinc-100 p-2 rounded text-sm"
                      value={selectedCompForPrint?.id || ''}
                      onChange={(e) => {
                        const comp = competitions.find(c => c.id === e.target.value);
                        setSelectedCompForPrint(comp || null);
                        if (comp && comp.events && comp.events.length > 0) {
                          setSelectedEventIdForPrint(comp.events[0].id);
                          if (comp.events[0].enrolledTeamIds && comp.events[0].enrolledTeamIds.length > 0) {
                            setSelectedTeamIdForPrint(comp.events[0].enrolledTeamIds[0]);
                          } else {
                            setSelectedTeamIdForPrint('');
                          }
                        } else {
                          setSelectedEventIdForPrint('');
                          setSelectedTeamIdForPrint('');
                        }
                      }}
                    >
                      {competitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Event</label>
                    <select 
                      className="w-full bg-zinc-100 p-2 rounded text-sm"
                      value={selectedEventIdForPrint}
                      onChange={(e) => {
                        setSelectedEventIdForPrint(e.target.value);
                        const event = selectedCompForPrint?.events?.find(ev => ev.id === e.target.value);
                        if (event && event.enrolledTeamIds && event.enrolledTeamIds.length > 0) {
                          setSelectedTeamIdForPrint(event.enrolledTeamIds[0]);
                        } else {
                          setSelectedTeamIdForPrint('');
                        }
                      }}
                    >
                      <option value="">-- SELECT EVENT --</option>
                      {selectedCompForPrint?.events?.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">Team</label>
                    <select 
                      className="w-full bg-zinc-100 p-2 rounded text-sm"
                      value={selectedTeamIdForPrint}
                      onChange={(e) => setSelectedTeamIdForPrint(e.target.value)}
                    >
                      <option value="">-- SELECT TEAM --</option>
                      {enrolledTeamsForPrint.map(t => <option key={t.id} value={t.id}>{t.schoolName} - {t.teamName}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {selectedCompForPrint && selectedEventForPrint && selectedTeamForPrint ? (
                <PrintableScoresheet 
                  competition={selectedCompForPrint} 
                  event={selectedEventForPrint}
                  team={selectedTeamForPrint}
                  judgeNumber="1"
                  isInteractive={user?.isAnonymous}
                />
              ) : (
                <div className="text-center text-zinc-500 py-20 uppercase tracking-widest text-sm">
                  No data available for printing. Select a competition, event, and team.
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
