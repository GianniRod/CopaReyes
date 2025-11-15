import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  onSnapshot, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Play, 
  Plus, 
  Trash2, 
  Activity, 
  Clock, 
  Crown,
  Timer,
  Flag,
  ShieldAlert,
  Target,
  Menu,
  X,
  Shirt,
  AlertTriangle
} from 'lucide-react';

// --- CONFIGURACIÓN FIREBASE (LEER DESDE VARIABLES DE ENTORNO VERCEL) ---
const firebaseConfig = {
    // Usamos import.meta.env.VITE_... para leer las variables de Vercel/Vite
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: import.meta.env.VITE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Usamos el Project ID como App ID
const appId = import.meta.env.VITE_PROJECT_ID || 'default-app-id'; // <--- El App ID se lee del PROJECT_ID

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// Usamos el Project ID como App ID
const appId = import.meta.env.VITE_PROJECT_ID || 'default-app-id';

// --- UTILIDADES ---
const playerPositions = [
    "POR", "DEF", "DEF", "DEF", "DEF", "MED", "MED", "MED", "DEL", "DEL", "DEL",
    "POR", "DEF", "DEF", "MED", "MED", "MED", "DEL", "DEL", "DEL"
];

const generateRoster = () => {
  return playerPositions.map((pos, index) => ({
    id: `pl-${Math.random().toString(36).substr(2, 9)}`,
    name: `Jugador ${index + 1}`,
    position: pos,
    number: index + 1,
    isStarter: index < 11,
    cards: { yellow: 0, red: 0 } 
  }));
};

// --- COMPONENTES UI ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border border-green-100 rounded-xl shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, variant = "primary", className = "", disabled = false, type = "button" }) => {
  const variants = {
    primary: "bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-200",
    secondary: "bg-white hover:bg-green-50 text-green-800 border border-green-200",
    danger: "bg-red-100 hover:bg-red-200 text-red-700 border border-red-200",
  };
  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Input = ({ label, ...props }) => (
  <div className="flex flex-col gap-1 mb-3">
    {label && <label className="text-[10px] uppercase tracking-widest text-green-600 font-bold">{label}</label>}
    <input 
      className="bg-white border border-green-200 text-green-900 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none transition-all w-full"
      {...props}
    />
  </div>
);

const Select = ({ label, options, ...props }) => (
  <div className="flex flex-col gap-1 mb-3">
    {label && <label className="text-[10px] uppercase tracking-widest text-green-600 font-bold">{label}</label>}
    <select 
      className="bg-white border border-green-200 text-green-900 rounded-lg p-2.5 focus:ring-2 focus:ring-green-500 outline-none w-full"
      {...props}
    >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const Badge = ({ status, period }) => {
  const styles = {
    scheduled: "bg-green-100 text-green-700 border border-green-200",
    live: "bg-red-600 text-white shadow-md shadow-red-200 animate-pulse",
    halftime: "bg-amber-400 text-amber-900 font-bold",
    finished: "bg-green-700 text-white",
  };
  const labels = {
    scheduled: "PROGRAMADO",
    live: period === '1T' ? "EN JUEGO (1T)" : "EN JUEGO (2T)",
    halftime: "MEDIO TIEMPO",
    finished: "FINALIZADO",
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider shadow-sm ${styles[status] || styles.scheduled}`}>
      {labels[status] || status}
    </span>
  );
};

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border-2 border-red-100 transform scale-100">
        <div className="flex items-center gap-3 text-red-600 mb-4">
           <div className="bg-red-100 p-2 rounded-full"><AlertTriangle size={24} /></div>
           <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-gray-600 mb-6 text-sm">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => { onConfirm(); onClose(); }}>Sí, Eliminar</Button>
        </div>
      </div>
    </div>
  );
};

const StatRow = ({ label, valA, valB, total }) => {
    const percentA = total > 0 ? (valA / total) * 100 : 50;
    return (
      <div className="mb-3">
          <div className="flex justify-between text-xs font-bold text-green-700 mb-1 uppercase tracking-widest">
              <span className="text-green-900">{valA}</span>
              <span className="text-gray-500">{label}</span>
              <span className="text-green-900">{valB}</span>
          </div>
          <div className="flex h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div className="bg-green-600" style={{ width: `${percentA}%` }}></div>
              <div className="bg-red-600" style={{ width: `${100 - percentA}%` }}></div>
          </div>
      </div>
    );
};


// --- APP PRINCIPAL ---

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard'); 
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [timeScale, setTimeScale] = useState(60000); // Default x1
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [deleteTeamId, setDeleteTeamId] = useState(null);
  const [deleteMatchId, setDeleteMatchId] = useState(null);

  // Auth: Usamos el inicio de sesión anónimo, ya que no tenemos el token
  useEffect(() => {
    const initAuth = async () => {
        try {
            await signInAnonymously(auth);
        } catch (e) {
            console.error("Error al iniciar sesión anónima:", e);
        }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user) return;
    
    // Firestore path for user-specific data
    const userTeamsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'teams');
    const userMatchesPath = collection(db, 'artifacts', appId, 'users', user.uid, 'matches');

    const unsubTeams = onSnapshot(
        query(userTeamsPath, orderBy('name')), 
        (snap) => setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err) => console.error("Error fetching teams:", err)
    );

    const unsubMatches = onSnapshot(
        query(userMatchesPath, orderBy('startTime')), 
        (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err) => console.error("Error fetching matches:", err)
    );

    return () => { unsubTeams(); unsubMatches(); };
  }, [user]); 

  // Game Loop
  useEffect(() => {
    if (!user || matches.length === 0) return;
    const intervalId = setInterval(() => {
      matches.forEach(match => {
        if (match.status === 'scheduled' && match.autoStart) {
           if (new Date() >= new Date(match.startTime)) startMatch(match);
        } else if (match.status === 'live' || match.status === 'halftime') {
          simulateStep(match);
        }
      });
    }, timeScale); 
    return () => clearInterval(intervalId);
  }, [user, matches, timeScale, teams]);

  // --- LÓGICA SIMULACIÓN ---
  const startMatch = async (match) => {
    if (!user) return;
    const teamA = teams.find(t => t.id === match.teamAId);
    const teamB = teams.find(t => t.id === match.teamBId);
    const rosterA = teamA?.roster || generateRoster();
    const rosterB = teamB?.roster || generateRoster();
    
    const initialStats = { 
      possession: 50, shotsA: 0, shotsB: 0, 
      onTargetA: 0, onTargetB: 0, foulsA: 0, foulsB: 0, 
      yellowA: 0, yellowB: 0, redA: 0, redB: 0, cornersA: 0, cornersB: 0 
    };

    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), {
      status: 'live', period: '1T', currentMinute: 0, addedTime: Math.floor(Math.random()*4)+1, halftimeCounter: 0, scoreA: 0, scoreB: 0,
      events: [{ type: 'whistle', minute: 0, text: '¡RUEDA EL BALÓN! Comienza el partido.' }],
      stats: initialStats, lineups: { teamA: rosterA, teamB: rosterB }
    });
  };

  const simulateStep = async (match) => {
    if (!match.lineups || !user) return; 
    let updates = {};
    const newEvents = [...match.events];
    const stats = { ...match.stats };
    const lineups = JSON.parse(JSON.stringify(match.lineups)); 
    
    if (match.status === 'halftime') {
      const newCounter = (match.halftimeCounter || 0) + 1;
      if (newCounter >= 15) {
        updates = { status: 'live', period: '2T', currentMinute: 45, halftimeCounter: 0, addedTime: Math.floor(Math.random()*5)+2, events: [...newEvents, { type: 'whistle', minute: 45, text: 'Arranca el Segundo Tiempo.' }] };
      } else {
        updates = { halftimeCounter: newCounter };
      }
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), updates);
      return;
    }

    const currentMin = match.currentMinute;
    const nextMin = currentMin + 1;
    const isFirstHalf = match.period === '1T';
    const regularTimeEnd = isFirstHalf ? 45 : 90;
    const maxTime = regularTimeEnd + (match.addedTime || 0);

    if (currentMin >= maxTime) {
      if (isFirstHalf) updates = { status: 'halftime', period: 'HT', halftimeCounter: 0, events: [...newEvents, { type: 'whistle', minute: currentMin, text: `Fin del 1T (+${match.addedTime}')` }] };
      else updates = { status: 'finished', events: [...newEvents, { type: 'whistle', minute: currentMin, text: `¡FINAL DEL PARTIDO! (+${match.addedTime}')` }] };
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), updates);
      return;
    }

    updates.currentMinute = nextMin;
    const teamA = teams.find(t => t.id === match.teamAId);
    const teamB = teams.find(t => t.id === match.teamBId);

    if (teamA && teamB) {
      const probA = parseFloat(teamA.probability); 
      const probB = parseFloat(teamB.probability);
      
      let targetPossession = 50 + (probA - probB) * 35;
      if (teamA.style === 'possession') targetPossession += 15;
      if (teamB.style === 'possession') targetPossession -= 15;
      stats.possession = Math.round(stats.possession + ((targetPossession - stats.possession) * 0.1) + (Math.random()*4-2));

      if (Math.random() < 0.22) { 
          let attackA = (probA * 0.5) + (stats.possession/200);
          let attackB = (probB * 0.5) + ((100-stats.possession)/200);
          const isTeamA = Math.random() * (attackA + attackB) < attackA;
          const attackingTeamName = isTeamA ? teamA.name : teamB.name;
          const roster = isTeamA ? lineups.teamA : lineups.teamB;
          const player = roster.filter(p=>p.isStarter)[Math.floor(Math.random()*11)] || {name:'Jugador'};

          if (Math.random() < 0.8) { 
             if (isTeamA) stats.shotsA++; else stats.shotsB++;
             if (Math.random() < 0.35) { 
                 if (isTeamA) stats.onTargetA++; else stats.onTargetB++;
                 let goalChance = 0.42 + ((isTeamA ? probA - probB : probB - probA) * 0.15);
                 if (Math.random() < goalChance) {
                     updates[isTeamA ? 'scoreA' : 'scoreB'] = (match[isTeamA ? 'scoreA' : 'scoreB'] || 0) + 1;
                     newEvents.push({ type: 'goal', minute: nextMin, text: `¡GOL de ${player.name}! (${attackingTeamName})` });
                 } else {
                     newEvents.push({ type: 'save', minute: nextMin, text: `¡Atajada impresionante ante disparo de ${player.name}!` });
                 }
             }
          } else {
             if (isTeamA) stats.cornersA++; else stats.cornersB++;
             newEvents.push({ type: 'corner', minute: nextMin, text: `Córner para ${attackingTeamName}.` });
          }
      }
      
      if (Math.random() < 0.08) { 
          if (Math.random() < 0.5) stats.foulsA++; else stats.foulsB++; 
          if (Math.random() < 0.005) {
             const isTeamA = Math.random() < 0.5;
             const cardRoster = isTeamA ? lineups.teamA : lineups.teamB;
             const cardPlayer = cardRoster.filter(p=>p.cards.red===0)[Math.floor(Math.random()*cardRoster.length)] || {name:'Jugador'};
             if (cardPlayer.name !== 'Jugador') {
                if (isTeamA) stats.yellowA++; else stats.yellowB++;
                newEvents.push({ type: 'card', minute: nextMin, text: `Tarjeta AMARILLA para ${cardPlayer.name}.` });
             }
          }
      }
    }
    updates.events = newEvents;
    updates.stats = stats;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), updates);
  };

  const updateMatchScoreManual = async (matchId, team, delta) => {
    if (!user) return;
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const updateData = {};
    if (team === 'A') updateData.scoreA = Math.max(0, match.scoreA + delta);
    if (team === 'B') updateData.scoreB = Math.max(0, match.scoreB + delta);
    updateData.events = [...match.events, { type: 'manual', minute: match.currentMinute || 0, text: `VAR: Ajuste manual de marcador` }];
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', matchId), updateData);
  };

  // --- COMPONENTES DE VISTA ---

  const MatchDetail = ({ match, onBack }) => {
      const teamA = teams.find(t => t.id === match.teamAId);
      const teamB = teams.find(t => t.id === match.teamBId);
      const stats = match.stats || { 
        possession: 50, shotsA: 0, shotsB: 0, 
        onTargetA: 0, onTargetB: 0, foulsA: 0, foulsB: 0, 
        yellowA: 0, yellowB: 0, redA: 0, redB: 0, cornersA: 0, cornersB: 0 
      };
      
      // CAMBIO: Estado local para el segundero
      const [seconds, setSeconds] = useState(0);

      // CAMBIO: Hook para el segundero (solo en x1)
      useEffect(() => {
        let timerId = null;
        if (match.status === 'live' && timeScale === 60000) {
          timerId = setInterval(() => {
            // El % 60 asegura que se reinicie si el bucle principal se retrasa
            setSeconds(prevSeconds => (prevSeconds + 1) % 60);
          }, 1000); // 1 segundo real
        }
        
        // Limpieza: se ejecuta si la velocidad cambia o el partido se pausa
        return () => {
          if (timerId) {
            clearInterval(timerId);
          }
          setSeconds(0); // Resetea los segundos al cambiar la velocidad
        };
      }, [match.status, timeScale]); // Depende del estado y la velocidad

      // CAMBIO: Hook para resetear el segundero cuando el minuto principal cambia
      useEffect(() => {
        setSeconds(0);
      }, [match.currentMinute]); // Resetea a 00 cuando el minuto avanza


      // Lógica de visualización de tiempo
      let timeDisplay = "";
      const displayMinute = String(match.currentMinute).padStart(2, '0');
      
      // Decide si usar el segundero o "00"
      const displaySeconds = (timeScale === 60000 && match.status === 'live' && match.currentMinute < 45) || (timeScale === 60000 && match.status === 'live' && match.currentMinute >= 45 && match.currentMinute < 90)
          ? String(seconds).padStart(2, '0')
          : '00';

      timeDisplay = `${displayMinute}:${displaySeconds}`;

      // Lógica para Medio Tiempo y Tiempo Añadido (sobrescriben lo anterior)
      if (match.status === 'halftime') {
          const remaining = 15 - (match.halftimeCounter || 0);
          timeDisplay = `MT (${String(remaining).padStart(2, '0')}:00)`;
      } else if ((match.period === '1T' && match.currentMinute > 45) || (match.period === '2T' && match.currentMinute > 90)) {
          const regular = match.period === '1T' ? 45 : 90;
          const added = match.currentMinute - regular;
          // El tiempo añadido no usa el segundero
          timeDisplay = `${String(regular).padStart(2, '0')}+${String(added).padStart(2, '0')}`;
      }

      const isFinished = match.status === 'finished';
      const scoreOpacityA = isFinished && match.scoreA < match.scoreB ? 'opacity-50' : 'opacity-100';
      const scoreOpacityB = isFinished && match.scoreB < match.scoreA ? 'opacity-50' : 'opacity-100';

      return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
              {/* Controles de velocidad y volver */}
              <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                <button onClick={onBack} className="text-green-700 hover:text-green-900 flex items-center gap-2 text-sm font-bold uppercase">← Volver</button>
                <div className="flex gap-1">
                   {[60000, 2000, 1000, 50].map(speed => (
                       <button key={speed} onClick={() => setTimeScale(speed)} className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-colors ${timeScale === speed ? 'bg-red-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                           {speed === 60000 ? 'x1' : speed === 2000 ? 'x30' : speed === 1000 ? 'x60' : '⚡'}
                       </button>
                   ))}
                </div>
              </div>
              
              {/* MARCADOR */}
              <div className="bg-gradient-to-r from-green-800 to-green-700 rounded-t-2xl border-b-4 border-red-600 p-6 md:p-8 text-center relative overflow-hidden shadow-xl">
                  <div className="flex justify-between items-center max-w-4xl mx-auto relative z-10">
                      {/* EQUIPO A */}
                      <div className="flex flex-col items-center w-1/3">
                           <img src={teamA?.logo || `https://ui-avatars.com/api/?name=${teamA?.name}`} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white shadow-lg bg-white object-cover" />
                           <h2 className="text-lg md:text-2xl font-bold text-white mt-4 tracking-tight leading-none drop-shadow-md">{teamA?.name}</h2>
                      </div>
                      
                      {/* RESULTADO CENTRAL */}
                      <div className="flex flex-col items-center w-1/3">
                          <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
                              {match.status === 'scheduled' ? (
                                <div className="text-4xl md:text-6xl font-sans font-bold text-white tracking-tighter drop-shadow-lg">
                                  VS
                                </div>
                              ) : (
                                <div className="text-4xl md:text-6xl font-sans font-bold text-white tracking-tighter flex items-center gap-2 drop-shadow-lg">
                                  <span className={`transition-opacity duration-500 ${scoreOpacityA}`}>{match.scoreA}</span>
                                  <span className="text-white/50 text-3xl">-</span>
                                  <span className={`transition-opacity duration-500 ${scoreOpacityB}`}>{match.scoreB}</span>
                                </div>
                              )}
                          </div>
                          <div className="mt-4 flex flex-col items-center gap-2">
                              <Badge status={match.status} period={match.period} />
                              {match.status !== 'finished' && match.status !== 'scheduled' && (
                                <div className="flex items-center gap-2 text-yellow-300 font-mono text-xl font-bold drop-shadow">
                                    <Clock size={20} /> {timeDisplay}
                                </div>
                              )}
                          </div>
                      </div>

                      {/* EQUIPO B */}
                      <div className="flex flex-col items-center w-1/3">
                           <img src={teamB?.logo || `https://ui-avatars.com/api/?name=${teamB?.name}`} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white shadow-lg bg-white object-cover" />
                           <h2 className="text-lg md:text-2xl font-bold text-white mt-4 tracking-tight leading-none drop-shadow-md">{teamB?.name}</h2>
                      </div>
                  </div>
              </div>

              {/* GRID PRINCIPAL: ESTADÍSTICAS Y EVENTOS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
                  
                  {/* LEFT: STATS (4 cols) */}
                  <div className="lg:col-span-4 space-y-4">
                      <div className="bg-white border border-green-100 rounded-xl p-6 shadow-sm">
                          <h3 className="text-green-800 uppercase text-xs font-bold mb-6 flex items-center gap-2 border-b border-green-100 pb-2">
                              <Activity size={14} className="text-red-600" /> Datos del Partido
                          </h3>
                          
                          <div className="space-y-5">
                             {/* Posesión */}
                             <div className="mb-6">
                                <div className="flex justify-between text-2xl font-mono font-bold text-green-900 mb-2">
                                    <span className="text-green-700">{stats.possession}%</span>
                                    <span className="text-[10px] font-sans text-gray-400 font-bold self-center uppercase">Posesión</span>
                                    <span className="text-red-700">{100 - stats.possession}%</span>
                                </div>
                                <div className="flex h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                    <div className="bg-green-600" style={{ width: `${stats.possession}%` }}></div>
                                    <div className="bg-red-600" style={{ width: `${100 - stats.possession}%` }}></div>
                                </div>
                             </div>
                             
                             <StatRow label="Tiros" valA={stats.shotsA} valB={stats.shotsB} total={stats.shotsA + stats.shotsB} />
                             <StatRow label="Al Arco" valA={stats.onTargetA} valB={stats.onTargetB} total={stats.onTargetA + stats.onTargetB} />
                             <StatRow label="Córners" valA={stats.cornersA} valB={stats.cornersB} total={stats.cornersA + stats.cornersB} />
                             
                             <div className="my-4 border-t border-green-50 border-dashed"></div>
                             
                             <StatRow label="Faltas" valA={stats.foulsA} valB={stats.foulsB} total={stats.foulsA + stats.foulsB} />
                             <StatRow label="Amarillas" valA={stats.yellowA} valB={stats.yellowB} total={stats.yellowA + stats.yellowB} />
                             <StatRow label="Rojas" valA={stats.redA} valB={stats.redB} total={stats.redA + stats.redB} />
                          </div>
                      </div>
                      
                      {/* Controles Manuales */}
                      <div className="bg-white border border-green-100 rounded-xl p-4 shadow-sm flex flex-col gap-2">
                           {match.status === 'scheduled' && <Button onClick={() => startMatch(match)} className="w-full"><Play size={14}/> Iniciar Partido</Button>}
                           {(match.status === 'live' || match.status === 'halftime') && <Button variant="secondary" onClick={() => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), { status: 'finished' })} className="w-full text-red-600 border-red-100">Terminar Partido</Button>}
                           <div className="flex gap-2 mt-2">
                              <button onClick={() => updateMatchScoreManual(match.id, 'A', 1)} className="flex-1 bg-green-50 hover:bg-green-100 text-green-800 text-xs font-bold py-2 rounded border border-green-200">+ GOL LOC</button>
                              <button onClick={() => updateMatchScoreManual(match.id, 'B', 1)} className="flex-1 bg-green-50 hover:bg-green-100 text-green-800 text-xs font-bold py-2 rounded border border-green-200">+ GOL VIS</button>
                           </div>
                      </div>
                  </div>
                  
                  {/* RIGHT: EVENTOS (8 cols) */}
                  <div className="lg:col-span-8 bg-white border border-green-100 rounded-xl overflow-hidden flex flex-col h-[600px] shadow-sm">
                      <div className="bg-green-50 p-3 border-b border-green-100"><h3 className="text-green-800 font-bold text-xs uppercase flex items-center gap-2"><Timer size={14} /> Minuto a Minuto</h3></div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                          {[...match.events].reverse().map((ev, idx) => (
                              <div key={idx} className={`flex items-start gap-3 p-3 rounded border shadow-sm ${ev.type === 'goal' ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-100'}`}>
                                  <div className="text-green-700 font-mono font-bold text-sm min-w-[28px] text-right">{ev.minute}'</div>
                                  <div className="flex-1"><p className={`text-sm font-medium ${ev.type === 'goal' ? 'text-green-900 font-bold' : 'text-gray-600'}`}>{ev.text}</p></div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      )
  };

  const MatchCard = ({ match, onClick, onDelete }) => {
      const teamA = teams.find(t => t.id === match.teamAId);
      const teamB = teams.find(t => t.id === match.teamBId);

      const teamADisplay = teamA?.shortName || teamA?.name.substring(0, 5) || 'LOC';
      const teamBDisplay = teamB?.shortName || teamB?.name.substring(0, 5) || 'VIS';

      const isFinished = match.status === 'finished';
      const scoreOpacityA = isFinished && match.scoreA < match.scoreB ? 'opacity-50' : 'opacity-100';
      const scoreOpacityB = isFinished && match.scoreB < match.scoreA ? 'opacity-50' : 'opacity-100';

      let timeLabel = "";
      if (match.status === 'scheduled') {
          timeLabel = new Date(match.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      } else if (match.status !== 'finished') {
          if (match.status === 'halftime') {
              timeLabel = "MT";
          } else if ((match.period === '1T' && match.currentMinute > 45) || (match.period === '2T' && match.currentMinute > 90)) {
              const regular = match.period === '1T' ? 45 : 90;
              const added = match.currentMinute - regular;
              timeLabel = `${String(regular).padStart(2, '0')}+${String(added).padStart(2, '0')}`;
          } else {
              // En la tarjeta, mostramos MM:00, ya que el segundero real solo está en el detalle
              timeLabel = `${String(match.currentMinute).padStart(2, '0')}:00`;
          }
      }

      return (
          <div onClick={onClick} className="bg-white border border-green-100 p-4 rounded-xl hover:border-green-400 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden">
              {match.status === 'live' && <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>}
              <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(match.id); }}
                  className="absolute top-2 right-2 z-20 text-gray-300 hover:text-red-600 p-1.5 bg-white/80 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all"
              >
                  <Trash2 size={14} />
              </button>
              <div className="flex justify-between items-center mb-4 pl-2">
                  <Badge status={match.status} period={match.period} />
                  <span className="text-xs text-gray-500 font-mono">{timeLabel}</span>
              </div>
              <div className="flex items-center justify-between pl-2">
                  <div className="flex items-center gap-3 w-1/3">
                      <img src={teamA?.logo || `https://ui-avatars.com/api/?name=${teamA?.name}`} className="w-8 h-8 rounded-full bg-white border object-cover" />
                      <span className="font-bold text-green-900 text-sm truncate">{teamADisplay}</span>
                  </div>
                  
                  <div className="font-sans font-bold text-2xl text-green-800 bg-green-50 px-4 py-1 rounded-lg border border-green-100 whitespace-nowrap flex-shrink-0 min-w-[80px] text-center">
                    {match.status === 'scheduled' ? (
                      <span className="text-xl text-green-600">VS</span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span className={`transition-opacity duration-500 ${scoreOpacityA}`}>{match.scoreA}</span>
                        <span>-</span>
                        <span className={`transition-opacity duration-500 ${scoreOpacityB}`}>{match.scoreB}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 w-1/3 justify-end">
                      <span className="font-bold text-green-900 text-sm truncate">{teamBDisplay}</span>
                      <img src={teamB?.logo || `https://ui-avatars.com/api/?name=${teamB?.name}`} className="w-8 h-8 rounded-full bg-white border object-cover" />
                  </div>
              </div>
          </div>
      );
  };

  const DashboardView = () => {
    const liveMatches = matches.filter(m => m.status === 'live' || m.status === 'halftime');
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="relative rounded-2xl overflow-hidden bg-green-800 p-8 shadow-xl text-white mb-8 border-b-4 border-red-600">
            <div className="relative z-10">
                <div className="flex items-center gap-2 text-yellow-400 font-bold uppercase tracking-widest text-sm mb-2"><Crown size={16} /> Edición Táctica</div>
                <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter mb-2">COPA DE LOS <span className="text-red-500 bg-white px-2 skew-x-[-10deg] inline-block">REYES</span> 2026</h2>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 border-l-4 border-l-red-500 bg-white shadow-sm">
             <div className="flex justify-between"><p className="text-gray-400 text-xs font-bold uppercase">En Juego</p><p className="text-3xl font-bold text-green-900">{liveMatches.length}</p></div>
          </Card>
          <Card className="p-5 border-l-4 border-l-green-600 bg-white shadow-sm">
             <div className="flex justify-between"><p className="text-gray-400 text-xs font-bold uppercase">Programados</p><p className="text-3xl font-bold text-green-900">{matches.filter(m => m.status === 'scheduled').length}</p></div>
          </Card>
          <Card className="p-5 border-l-4 border-l-yellow-500 bg-white shadow-sm">
             <div className="flex justify-between"><p className="text-gray-400 text-xs font-bold uppercase">Clubes</p><p className="text-3xl font-bold text-green-900">{teams.length}</p></div>
          </Card>
        </div>
      </div>
    );
  };

  const TeamsView = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({ name: '', shortName: '', logo: '', probability: 0.5, style: 'balanced' });
    
    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        if (!user) return; 
        const roster = generateRoster();
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'teams'), { ...formData, roster, createdAt: serverTimestamp() }); 
        setIsEditing(false); 
        setFormData({ name: '', shortName: '', logo: '', probability: 0.5, style: 'balanced' }); 
    };

    return (
      <div>
        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-green-900">Clubes Registrados</h2><Button onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Cancelar' : <><Plus size={16} /> Nuevo Club</>}</Button></div>
        {isEditing && (
          <Card className="p-6 mb-6 bg-white shadow-lg animate-in slide-in-from-top-2">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <Input label="Nombre Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="md:col-span-2" />
               <Input 
                  label="Abreviatura (3 letras)" 
                  value={formData.shortName} 
                  onChange={e => setFormData({...formData, shortName: e.target.value.toUpperCase().substring(0, 3)})} 
                  maxLength={3}
               />
               <Input label="Logo URL" value={formData.logo} onChange={e => setFormData({...formData, logo: e.target.value})} />
               <Select label="Estilo" value={formData.style} onChange={e => setFormData({...formData, style: e.target.value})} options={[{ value: 'balanced', label: 'Equilibrado' }, { value: 'possession', label: 'Posesión' }, { value: 'counter', label: 'Contraataque' }]} />
               <div>
                   <label className="text-[10px] uppercase tracking-widest text-green-600 font-bold mb-1 block">Fuerza: {Math.round(formData.probability*100)}%</label>
                   <input type="range" min="0.1" max="1.0" step="0.01" className="w-full h-2 bg-green-100 rounded-lg accent-green-600" value={formData.probability} onChange={e => setFormData({...formData, probability: parseFloat(e.target.value)})} />
               </div>
               <Button type="submit" className="md:col-span-3">Guardar Equipo</Button>
            </form>
          </Card>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{teams.map(t => (
            <div key={t.id} className="bg-white border border-green-100 p-4 rounded-lg shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-4">
                    <img src={t.logo || `https://ui-avatars.com/api/?name=${t.name}`} className="w-12 h-12 rounded-full shadow-sm object-cover" />
                    <div className="flex-1">
                        <div className="font-bold text-sm text-green-900">{t.name} ({t.shortName || 'N/A'})</div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">{t.style}</div>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setDeleteTeamId(t.id); }} 
                        className="text-gray-400 hover:text-red-500 p-2"
                    >
                        <Trash2 size={16}/>
                    </button>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{width: `${t.probability*100}%`}}></div></div>
            </div>
        ))}</div>
      </div>
    );
  };

  const MatchesView = () => {
    const [isScheduling, setIsScheduling] = useState(false);
    const [formData, setFormData] = useState({ teamAId: '', teamBId: '', startTime: '', autoStart: true });
    
    const handleSchedule = async (e) => { 
        e.preventDefault(); 
        if (!user) return;
        if (!formData.teamAId || !formData.teamBId || !formData.startTime) return;
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'matches'), { ...formData, status: 'scheduled', scoreA: 0, scoreB: 0, currentMinute: 0, events: [], period: '1T', addedTime: 0, halftimeCounter: 0, createdAt: serverTimestamp() });
        setIsScheduling(false); 
    };

    return (
      <div>
         <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-green-900">Calendario</h2><Button onClick={() => setIsScheduling(!isScheduling)}>{isScheduling ? 'Cancelar' : <><Calendar size={16} /> Programar</>}</Button></div>
         {isScheduling && <Card className="p-6 mb-6 shadow-lg animate-in slide-in-from-top-2"><form onSubmit={handleSchedule} className="grid gap-4"><Select options={[{value:'', label:'Local...'}, ...teams.map(t => ({value:t.id, label:t.name}))]} value={formData.teamAId} onChange={e=>setFormData({...formData, teamAId: e.target.value})} /><Select options={[{value:'', label:'Visita...'}, ...teams.filter(t=>t.id!==formData.teamAId).map(t => ({value:t.id, label:t.name}))]} value={formData.teamBId} onChange={e=>setFormData({...formData, teamBId: e.target.value})} /><Input type="datetime-local" value={formData.startTime} onChange={e=>setFormData({...formData, startTime: e.target.value})} /><label className="flex items-center gap-2 text-sm text-green-700 font-bold"><input type="checkbox" checked={formData.autoStart} onChange={e=>setFormData({...formData, autoStart: e.target.checked})} className="accent-green-600 w-4 h-4" /> Iniciar auto</label><Button type="submit">Confirmar</Button></form></Card>}
         <div className="grid gap-3">{matches.map(m => (
             <MatchCard 
                key={m.id} 
                match={m} 
                onClick={() => setSelectedMatchId(m.id)} 
                onDelete={(id) => setDeleteMatchId(id)}
             />
         ))}</div>
      </div>
    );
  };

  if (!user) return (
    <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center text-green-800 font-sans p-4">
      <div className="animate-spin text-green-600 mb-4"><Activity size={32} /></div>
      <div className="font-bold text-lg animate-pulse">Cargando Sistema de Táctica...</div>
      <div className="text-sm text-green-600 mt-2">Autenticando con Firebase</div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-lime-50 text-green-900 font-sans pb-20 md:pb-0 selection:bg-green-200">
      <ConfirmModal 
        isOpen={!!deleteTeamId} 
        title="¿Eliminar Club?" 
        message="Esta acción no se puede deshacer y borrará todos los datos asociados al equipo."
        onClose={() => setDeleteTeamId(null)}
        onConfirm={async () => {
            if(user) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'teams', deleteTeamId));
        }}
      />
      
      <ConfirmModal 
        isOpen={!!deleteMatchId} 
        title="¿Borrar Partido?" 
        message="El partido será eliminado del historial permanentemente."
        onClose={() => setDeleteMatchId(null)}
        onConfirm={async () => {
            if(user) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', deleteMatchId));
        }}
      />

      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-green-800 flex-col p-6 z-50 shadow-2xl border-r border-green-700">
        <div className="flex flex-col items-center mb-10 text-white border-b border-green-700 pb-6">
          <Crown size={48} className="mb-2 text-yellow-400 drop-shadow-md" />
          <h1 className="text-center font-black italic text-lg leading-tight tracking-tight">COPA DE LOS <br/><span className="text-red-500 bg-white px-1 rounded-sm inline-block mt-1 transform -skew-x-12 shadow-sm">REYES 2026</span></h1>
        </div>
        <nav className="space-y-2 flex-1">
          {[{ id: 'dashboard', icon: Activity, label: 'Inicio' }, { id: 'teams', icon: Users, label: 'Clubes' }, { id: 'matches', icon: Calendar, label: 'Partidos' }].map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setSelectedMatchId(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-bold uppercase tracking-wide ${view === item.id ? 'bg-white text-green-800 shadow-md' : 'text-green-100 hover:bg-green-700 hover:text-white'}`}>
              <item.icon size={18} className={view === item.id ? "text-red-600" : ""} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="text-[10px] text-center text-green-300 uppercase font-bold tracking-wider">v3.8 Táctica</div>
      </div>
      <div className="md:hidden bg-green-800 p-4 flex justify-between items-center sticky top-0 z-40 shadow-md">
         <div className="flex items-center gap-2 text-white font-black italic"><Crown size={20} className="text-yellow-400"/> COPA REYES</div>
         <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white">{mobileMenuOpen ? <X /> : <Menu />}</button>
      </div>
      {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-green-900/95 z-50 flex flex-col items-center justify-center gap-8">
              <button onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 text-white"><X size={32} /></button>
              {[{ id: 'dashboard', label: 'Inicio' }, { id: 'teams', label: 'Clubes' }, { id: 'matches', label: 'Partidos' }].map(item => (
                <button key={item.id} onClick={() => { setView(item.id); setSelectedMatchId(null); setMobileMenuOpen(false); }} className="text-2xl font-bold text-white uppercase tracking-widest hover:text-yellow-400">{item.label}</button>
              ))}
          </div>
      )}
      <main className="md:pl-64 p-4 md:p-8 max-w-6xl mx-auto">
         {selectedMatchId ? <MatchDetail match={matches.find(m => m.id === selectedMatchId)} onBack={() => setSelectedMatchId(null)} /> : (
            <>{view === 'dashboard' && <DashboardView />}{view === 'teams' && <TeamsView />}{view === 'matches' && <MatchesView />}</>
         )}
      </main>
    </div>
  );
}
    

