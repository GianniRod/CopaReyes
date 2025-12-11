import React, { useState, useEffect, useMemo } from 'react';
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
  serverTimestamp,
  writeBatch,
  arrayUnion, 
  arrayRemove,
  where,
  getDocs
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
  AlertTriangle,
  Repeat,
  Check,
  XCircle,
  Shield, 
  UsersRound, 
  CheckSquare, 
  Trello, 
  ArrowLeft,
  Edit,
  Eye,
  Pencil, 
  Save,
  Settings,
  TrendingUp,
  BarChart3,
  RotateCcw
} from 'lucide-react';


   const firebaseConfig = {
       apiKey: import.meta.env.VITE_API_KEY,
       authDomain: import.meta.env.VITE_AUTH_DOMAIN,
       projectId: import.meta.env.VITE_PROJECT_ID,
       storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
       messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
       appId: import.meta.env.VITE_APP_ID
   };
   const appId = import.meta.env.VITE_PROJECT_ID || 'default-app-id';



const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


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

const getInitialPenaltyShootout = () => ({
  scoreA: 0,
  scoreB: 0,
  attemptsA: 0,
  attemptsB: 0,
  kicker: 'A', 
  log: [],
  winner: null,
  isKicking: false
});

const formatDate = (dateString) => {
    if (!dateString) return "Fecha TBD";
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// --- MOTOR DE SIMULACIÓN DE PROBABILIDADES (MODO EXTREMO) ---
const simulateQuickMatch = (probA, probB, startMinute = 0, currentScoreA = 0, currentScoreB = 0) => {
    let sA = currentScoreA;
    let sB = currentScoreB;
    
    const baseGoalChance = 0.10; 

    for (let m = startMinute; m < 90; m++) {
        // AJUSTE EXTREMO 1: Diferencia masiva en generación de juego
        // Si probA es 0.8 y probB es 0.2, A tendrá 4 veces mas chances de atacar
        let attackA = Math.pow(probA, 2); 
        let attackB = Math.pow(probB, 2);
        
        const totalAttack = attackA + attackB;
        const random = Math.random();
        
        if (random < 0.22) { 
            const isTeamA = Math.random() * totalAttack < attackA;
            const diff = isTeamA ? probA - probB : probB - probA;
            
            // AJUSTE EXTREMO 2: Conversión letal para el fuerte
            // Si la diferencia es grande, la chance de gol se dispara
            let goalChance = baseGoalChance + (diff * 0.45); // Aumentado drásticamente
            
            if (Math.random() < Math.max(0.005, goalChance)) {
                if (isTeamA) sA++; else sB++;
            }
        }
    }
    return { sA, sB };
};

const calculateOdds = (teamA, teamB, startMinute = 0, currentScoreA = 0, currentScoreB = 0) => {
    if (!teamA || !teamB) return { win: 0, draw: 0, loss: 0 };

    const iterations = 1500; 
    let winsA = 0;
    let draws = 0;
    let winsB = 0;

    const probA = parseFloat(teamA.probability || 0.5);
    const probB = parseFloat(teamB.probability || 0.5);

    for (let i = 0; i < iterations; i++) {
        const result = simulateQuickMatch(probA, probB, startMinute, currentScoreA, currentScoreB);
        if (result.sA > result.sB) winsA++;
        else if (result.sB > result.sA) winsB++;
        else draws++;
    }

    const pWin = winsA / iterations;
    const pDraw = draws / iterations;
    const pLoss = winsB / iterations;

    const formatOdd = (p) => p > 0.002 ? (1 / p).toFixed(2) : "500.00";

    return {
        home: formatOdd(pWin),
        draw: formatOdd(pDraw),
        away: formatOdd(pLoss),
        probs: { w: (pWin*100).toFixed(0), d: (pDraw*100).toFixed(0), l: (pLoss*100).toFixed(0) }
    };
};


const calculateStandings = (groupId, teamIds, allTeams, allMatches) => {
    const standings = teamIds.map(id => {
        const teamData = allTeams.find(t => t.id === id) || { id, name: 'Equipo Desconocido' };
        return { 
            ...teamData, 
            P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 
        };
    });

    const groupMatches = allMatches.filter(m => m.groupId === groupId && m.status === 'finished');
    
    for (const match of groupMatches) {
        const teamA = standings.find(t => t.id === match.teamAId);
        const teamB = standings.find(t => t.id === match.teamBId);
        
        if (!teamA || !teamB) continue;

        teamA.P++;
        teamB.P++;
        teamA.GF += match.scoreA;
        teamA.GA += match.scoreB;
        teamB.GF += match.scoreB;
        teamB.GA += match.scoreA;
        
        if (match.scoreA > match.scoreB) { 
            teamA.W++; 
            teamA.Pts += 3; 
            teamB.L++; 
        } else if (match.scoreB > match.scoreA) { 
            teamB.W++; 
            teamB.Pts += 3; 
            teamA.L++; 
        } else { 
            teamA.D++; 
            teamA.Pts += 1; 
            teamB.D++; 
            teamB.Pts += 1; 
        }
    }
    
    standings.forEach(t => t.GD = t.GF - t.GA);
    
    standings.sort((a, b) => {
        if (a.Pts !== b.Pts) return b.Pts - a.Pts;
        if (a.GD !== b.GD) return b.GD - a.GD;
        if (a.GF !== b.GF) return b.GF - a.GF;
        return a.name.localeCompare(b.name);
    });
    
    return standings;
};


// --- COMPONENTES UI (BRASIL EDITION) ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-white border-l-4 border-l-[#009B3A] rounded-xl shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
);

const Button = ({ onClick, children, variant = "primary", className = "", disabled = false, type = "button" }) => {
  const variants = {
    primary: "bg-[#F58220] hover:bg-[#d66e15] text-white font-bold shadow-md shadow-orange-100",
    secondary: "bg-white hover:bg-[#009B3A]/10 text-[#091F40] border border-[#009B3A]",
    danger: "bg-[#EF4135] hover:bg-[#c9342a] text-white border border-red-700",
    dark: "bg-[#091F40] hover:bg-[#06152b] text-white border border-slate-800"
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

const SmallInput = ({ ...props }) => (
  <input 
    className="bg-slate-50 border border-slate-200 text-[#091F40] rounded-lg p-2 focus:ring-2 focus:ring-[#009B3A] outline-none transition-all w-full"
    {...props}
  />
);
const SmallSelect = ({ options, ...props }) => (
  <select 
    className="bg-slate-50 border border-slate-200 text-[#091F40] rounded-lg p-2 focus:ring-2 focus:ring-[#009B3A] outline-none w-full"
    {...props}
  >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
  </select>
);

const Input = ({ label, ...props }) => (
  <div className="flex flex-col gap-1 mb-3">
    {label && <label className="text-[10px] uppercase tracking-widest text-[#009B3A] font-bold">{label}</label>}
    <input 
      className="bg-slate-50 border border-slate-200 text-[#091F40] rounded-lg p-2.5 focus:ring-2 focus:ring-[#009B3A] outline-none transition-all w-full"
      {...props}
    />
  </div>
);

const Select = ({ label, options, ...props }) => (
  <div className="flex flex-col gap-1 mb-3">
    {label && <label className="text-[10px] uppercase tracking-widest text-[#009B3A] font-bold">{label}</label>}
    <select 
      className="bg-slate-50 border border-slate-200 text-[#091F40] rounded-lg p-2.5 focus:ring-2 focus:ring-[#009B3A] outline-none w-full"
      {...props}
    >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  </div>
);

const Badge = ({ status, period }) => {
  const styles = {
    scheduled: "bg-slate-100 text-slate-600 border border-slate-200",
    live: "bg-[#EF4135] text-white shadow-md shadow-red-200 animate-pulse",
    halftime: "bg-[#F58220] text-white font-bold",
    penalties: "bg-[#091F40] text-white shadow-md shadow-slate-300 animate-pulse",
    finished: "bg-[#009B3A] text-white",
  };
  const labels = {
    scheduled: "PROGRAMADO",
    live: period === '1T' ? "EN JUEGO (1T)" : "EN JUEGO (2T)",
    halftime: "MEDIO TIEMPO",
    penalties: "¡PENALES!",
    finished: "FINALIZADO",
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider shadow-sm ${styles[status] || styles.scheduled}`}>
      {labels[status] || status}
    </span>
  );
};

const ToggleSwitch = ({ isEnabled, onToggle, labelLeft, labelRight, IconLeft, IconRight }) => (
  <div className="flex items-center gap-2">
    <span className={`font-bold text-xs uppercase ${!isEnabled ? 'text-[#EF4135]' : 'text-gray-400'}`}>
        {IconLeft && <IconLeft size={16} className="inline-block mr-1" />}
        {labelLeft}
    </span>
    <button
      onClick={onToggle}
      className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isEnabled ? 'bg-[#009B3A]' : 'bg-gray-300'}`}
    >
      <span
        className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
    <span className={`font-bold text-xs uppercase ${isEnabled ? 'text-[#009B3A]' : 'text-gray-400'}`}>
        {IconRight && <IconRight size={16} className="inline-block mr-1" />}
        {labelRight}
    </span>
  </div>
);


const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#091F40]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border-l-4 border-l-[#EF4135] transform scale-100">
        <div className="flex items-center gap-3 text-[#EF4135] mb-4">
           <div className="bg-red-50 p-2 rounded-full"><AlertTriangle size={24} /></div>
           <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-gray-600 mb-6 text-sm">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>Sí, Continuar</Button>
        </div>
      </div>
    </div>
  );
};

const EditDateModal = ({ isOpen, onClose, onConfirm, currentDate }) => {
  const [newDate, setNewDate] = useState(currentDate || '');
  
  useEffect(() => {
      setNewDate(currentDate || '');
  }, [currentDate, isOpen]);

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#091F40]/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border-l-4 border-l-[#009B3A] transform scale-100">
        <div className="flex items-center gap-3 text-[#009B3A] mb-4">
           <div className="bg-green-50 p-2 rounded-full"><Calendar size={24} /></div>
           <h3 className="text-lg font-bold">Reprogramar Partido</h3>
        </div>
        <div className="mb-6">
            <Input 
                type="datetime-local" 
                label="Nueva Fecha y Hora"
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)} 
            />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => { onConfirm(newDate); onClose(); }}>Guardar</Button>
        </div>
      </div>
    </div>
  );
};

const StatRow = ({ label, valA, valB, total }) => {
    const percentA = total > 0 ? (valA / total) * 100 : 50;
    return (
      <div className="mb-3">
          <div className="flex justify-between text-xs font-bold text-[#091F40] mb-1 uppercase tracking-widest">
              <span className="text-[#009B3A]">{valA}</span>
              <span className="text-gray-400">{label}</span>
              <span className="text-[#F58220]">{valB}</span>
          </div>
          <div className="flex h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
              <div className="bg-[#009B3A]" style={{ width: `${percentA}%` }}></div>
              <div className="bg-[#F58220]" style={{ width: `${100 - percentA}%` }}></div>
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
  const [tournaments, setTournaments] = useState([]); 
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [timeScale, setTimeScale] = useState(60000); // Default x1
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [deleteTeamId, setDeleteTeamId] = useState(null);
  const [deleteMatchId, setDeleteMatchId] = useState(null);
  const [deleteTournamentId, setDeleteTournamentId] = useState(null); 
  
  const [editDateMatchId, setEditDateMatchId] = useState(null);
  const [editDateCurrent, setEditDateCurrent] = useState('');

  // Nuevo estado para reiniciar torneo
  const [resetTournamentId, setResetTournamentId] = useState(null);

  // Auth
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Data Fetching
  useEffect(() => {
    if (!user) return;
    
    const teamsPath = collection(db, 'artifacts', appId, 'public', 'data', 'teams');
    const matchesPath = collection(db, 'artifacts', appId, 'public', 'data', 'matches');
    const tournamentsPath = collection(db, 'artifacts', appId, 'public', 'data', 'tournaments'); 

    const unsubTeams = onSnapshot(
        query(teamsPath, orderBy('name')), 
        (snap) => setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err) => console.error("Error fetching teams:", err)
    );

    const unsubMatches = onSnapshot(
        query(matchesPath, orderBy('startTime', 'desc')), 
        (snap) => setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err) => console.error("Error fetching matches:", err)
    );

    const unsubTournaments = onSnapshot(
        query(tournamentsPath, orderBy('createdAt', 'desc')),
        (snap) => setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        (err) => console.error("Error fetching tournaments:", err)
    );

    return () => { unsubTeams(); unsubMatches(); unsubTournaments(); }; 
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

    let startText = '¡RUEDA EL BALÓN! Comienza el partido.';
    if (match.matchType === 'leg1') startText = '¡Comienza el partido de IDA!';
    if (match.matchType === 'leg2') startText = '¡Comienza el partido de VUELTA!';
    if (match.groupId) startText = `¡Comienza el partido del ${match.groupName || 'Grupo'}!`; 

    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', match.id), {
      status: 'live', period: '1T', currentMinute: 0, addedTime: Math.floor(Math.random()*4)+1, halftimeCounter: 0, scoreA: 0, scoreB: 0,
      events: [{ type: 'whistle', minute: 0, text: startText }],
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
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', match.id), updates);
      return;
    }

    const currentMin = match.currentMinute;
    const nextMin = currentMin + 1;
    const isFirstHalf = match.period === '1T';
    const regularTimeEnd = isFirstHalf ? 45 : 90;
    const maxTime = regularTimeEnd + (match.addedTime || 0);

    // --- FIN DE PARTIDO ---
    if (currentMin >= maxTime) {
      if (isFirstHalf) {
        updates = { status: 'halftime', period: 'HT', halftimeCounter: 0, events: [...newEvents, { type: 'whistle', minute: currentMin, text: `Fin del 1T (+${match.addedTime}')` }] };
      } else {
        newEvents.push({ type: 'whistle', minute: currentMin, text: `¡FINAL DEL PARTIDO! (+${match.addedTime}')` });
        updates.events = newEvents;
        
        if (match.matchType === 'group') {
            updates.status = 'finished';
        }
        else if (match.matchType === 'single' || match.matchType === 'knockout') {
            if (match.scoreA === match.scoreB) {
              updates.status = 'penalties';
              updates.penaltyShootout = getInitialPenaltyShootout();
              newEvents.push({ type: 'whistle', minute: 90, text: '¡El partido termina en empate! Habrá tanda de penales.' });
            } else {
              updates.status = 'finished';
            }
        } else if (match.matchType === 'leg1') {
            updates.status = 'finished';
        } else if (match.matchType === 'leg2') {
            const leg1 = matches.find(m => m.seriesId === match.seriesId && m.matchType === 'leg1');
            if (!leg1) {
                updates.status = 'finished';
            } else {
                const aggA = leg1.scoreA + match.scoreB;
                const aggB = leg1.scoreB + match.scoreA;
                if (aggA === aggB) {
                  updates.status = 'penalties';
                  updates.penaltyShootout = getInitialPenaltyShootout();
                  newEvents.push({ type: 'whistle', minute: 90, text: `¡Marcador global empatado ${aggA}-${aggB}! Habrá tanda de penales.` });
                } else {
                  updates.status = 'finished';
                }
            }
        } else {
            updates.status = 'finished';
        }
      }
      
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', match.id), updates);
      return;
    }

    updates.currentMinute = nextMin;
    const teamA = teams.find(t => t.id === match.teamAId);
    const teamB = teams.find(t => t.id === match.teamBId);

    if (teamA && teamB) {
      const probA = parseFloat(teamA.probability); 
      const probB = parseFloat(teamB.probability);
      
      // AJUSTE EXTREMO: La posesión se polariza brutalmente
      let targetPossession = 50 + (probA - probB) * 90; // Antes 35, luego 50, ahora 90!
      if (targetPossession > 95) targetPossession = 95;
      if (targetPossession < 5) targetPossession = 5;

      if (teamA.style === 'possession') targetPossession += 10;
      if (teamB.style === 'possession') targetPossession -= 10;
      stats.possession = Math.round(stats.possession + ((targetPossession - stats.possession) * 0.15) + (Math.random()*4-2));

      if (Math.random() < 0.22) { 
          // AJUSTE EXTREMO: El fuerte tiene casi todo el ataque
          let attackA = Math.pow(probA, 2) + (stats.possession/150); 
          let attackB = Math.pow(probB, 2) + ((100-stats.possession)/150);
          
          const isTeamA = Math.random() * (attackA + attackB) < attackA;
          const attackingTeamName = isTeamA ? teamA.name : teamB.name;
          const roster = isTeamA ? lineups.teamA : lineups.teamB;
          const player = roster.filter(p=>p.isStarter)[Math.floor(Math.random()*11)] || {name:'Jugador'};

          if (Math.random() < 0.8) { 
             if (isTeamA) stats.shotsA++; else stats.shotsB++;
             if (Math.random() < 0.35) { 
                 if (isTeamA) stats.onTargetA++; else stats.onTargetB++;
                 
                 // AJUSTE EXTREMO: Si eres mucho mejor, es gol seguro
                 const diff = isTeamA ? probA - probB : probB - probA;
                 let goalChance = 0.35 + (diff * 0.7); // Antes 0.3

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
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', match.id), updates);
  };

  const updateMatchScoreManual = async (matchId, team, delta) => {
    if (!user) return;
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const updateData = {};
    if (team === 'A') updateData.scoreA = Math.max(0, match.scoreA + delta);
    if (team === 'B') updateData.scoreB = Math.max(0, match.scoreB + delta);
    updateData.events = [...match.events, { type: 'manual', minute: match.currentMinute || 0, text: `VAR: Ajuste manual de marcador` }];
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', matchId), updateData);
  };

  const handlePenaltyKick = async (match) => {
    if (!user || !match.penaltyShootout || match.penaltyShootout.isKicking || match.penaltyShootout.winner) return;
    const teamA = teams.find(t => t.id === match.teamAId);
    const teamB = teams.find(t => t.id === match.teamBId);
    if (!teamA || !teamB) return;
    const currentShootout = JSON.parse(JSON.stringify(match.penaltyShootout));
    const newEvents = [...match.events];
    currentShootout.isKicking = true;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', match.id), { penaltyShootout: currentShootout });
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));
    const kickerSide = currentShootout.kicker;
    const kickerTeam = (kickerSide === 'A') ? teamA : teamB;
    const keeperTeam = (kickerSide === 'A') ? teamB : teamA;
    let baseProb = 0.75; 
    let kickerAdj = (parseFloat(kickerTeam.probability) - 0.5) * 0.3;
    let keeperAdj = (parseFloat(keeperTeam.probability) - 0.5) * 0.3;
    let finalProb = Math.max(0.5, Math.min(0.95, baseProb + kickerAdj - keeperAdj));
    const isGoal = Math.random() < finalProb;
    currentShootout.isKicking = false;
    currentShootout.log.push({ kicker: kickerSide, result: isGoal ? 'goal' : 'miss' });
    if (kickerSide === 'A') {
      currentShootout.attemptsA++;
      if (isGoal) currentShootout.scoreA++;
      currentShootout.kicker = 'B';
      newEvents.push({ type: isGoal ? 'goal' : 'save', minute: 'PEN', text: isGoal ? `¡GOL de ${kickerTeam.name}!` : `¡FALLÓ ${kickerTeam.name}!` });
    } else {
      currentShootout.attemptsB++;
      if (isGoal) currentShootout.scoreB++;
      currentShootout.kicker = 'A';
      newEvents.push({ type: isGoal ? 'goal' : 'save', minute: 'PEN', text: isGoal ? `¡GOL de ${kickerTeam.name}!` : `¡FALLÓ ${kickerTeam.name}!` });
    }
    let newStatus = 'penalties';
    const { scoreA, scoreB, attemptsA, attemptsB } = currentShootout;
    if (attemptsA <= 5 && attemptsB <= 5) {
      const kicksLeftA = 5 - attemptsA;
      const kicksLeftB = 5 - attemptsB;
      if (scoreA > scoreB + kicksLeftB) { currentShootout.winner = 'A'; }
      else if (scoreB > scoreA + kicksLeftA) { currentShootout.winner = 'B'; }
      else if (attemptsA === 5 && attemptsB === 5 && scoreA !== scoreB) { currentShootout.winner = (scoreA > scoreB) ? 'A' : 'B'; }
    } 
    if (attemptsA > 5 && attemptsA === attemptsB) {
      if (scoreA > scoreB) { currentShootout.winner = 'A'; }
      else if (scoreB > scoreA) { currentShootout.winner = 'B'; }
    }
    if (currentShootout.winner) {
      newStatus = 'finished';
      const winnerTeam = (currentShootout.winner === 'A') ? teamA : teamB;
      newEvents.push({ type: 'whistle', minute: 'PEN', text: `¡${winnerTeam.name} GANA LA TANDA DE PENALES!` });
    }
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', match.id), {
      status: newStatus,
      penaltyShootout: currentShootout,
      events: newEvents
    });
  };

  const handleUpdateMatchDate = async (newDate) => {
      if (!user || !editDateMatchId || !newDate) return;
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', editDateMatchId), {
          startTime: newDate
      });
      setEditDateMatchId(null);
  };

  // --- NUEVO: FUNCIÓN PARA REINICIAR TORNEO ---
  const handleResetTournament = async (tournamentId) => {
      if (!user) return;
      
      // 1. Resetear estructura del torneo
      const tourneyRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournaments', tournamentId);
      await updateDoc(tourneyRef, {
          groups: [],
          knockout: null
      });

      // 2. Borrar partidos asociados a este torneo
      const matchesRef = collection(db, 'artifacts', appId, 'public', 'data', 'matches');
      const q = query(matchesRef, where("tournamentId", "==", tournamentId));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
      });
      await batch.commit();
      
      setResetTournamentId(null);
  };


  // --- COMPONENTES DE VISTA ---

  const PenaltyShootoutUI = ({ match, onKick }) => {
    const teamA = teams.find(t => t.id === match.teamAId);
    const teamB = teams.find(t => t.id === match.teamBId);
    const shootout = match.penaltyShootout;
    if (!teamA || !teamB || !shootout) return null;
    const renderIcon = (result, index) => {
      if (result === 'goal') {
        return <div key={index} className="w-7 h-7 rounded-full bg-[#009B3A] border-2 border-green-600 flex items-center justify-center shadow-inner">
          <Check size={18} className="text-white" />
        </div>;
      }
      if (result === 'miss') {
        return <div key={index} className="w-7 h-7 rounded-full bg-[#EF4135] border-2 border-red-600 flex items-center justify-center shadow-inner">
          <X size={18} className="text-white" />
        </div>;
      }
      return <div key={index} className="w-7 h-7 rounded-full bg-slate-200 border-2 border-slate-300 shadow-inner"></div>;
    };
    const getKicks = (side) => {
        const kicks = shootout.log.filter(k => k.kicker === side).map(k => k.result);
        const totalAttempts = Math.max(shootout.attemptsA, shootout.attemptsB);
        let displayAttempts = Math.max(5, totalAttempts);
        if (shootout.winner) { displayAttempts = totalAttempts; }
        while(kicks.length < displayAttempts) { kicks.push(null); }
        return kicks;
    };
    const kicksA = getKicks('A');
    const kicksB = getKicks('B');
    const kicksA_row1 = kicksA.slice(0, 5);
    const kicksA_row2 = kicksA.slice(5);
    const kicksB_row1 = kicksB.slice(0, 5);
    const kicksB_row2 = kicksB.slice(5);
    const kickerName = shootout.kicker === 'A' ? teamA.name : teamB.name;
    const isFinished = !!shootout.winner;
    return (
      <Card className="lg:col-span-12 bg-slate-50 border-slate-200 animate-in fade-in duration-300">
        <div className="p-6">
          <h3 className="text-[#091F40] uppercase text-sm font-bold mb-6 flex items-center gap-2 border-b border-slate-200 pb-2">
            <Target size={14} className="text-[#009B3A]" /> Tanda de Penales
          </h3>
          <div className="flex justify-center items-start gap-6 mb-6">
            <div className="flex flex-col items-center gap-3 flex-1">
              <span className="text-lg font-bold text-[#091F40] text-center">{teamA.name}</span>
              <div className="flex flex-col gap-2 items-center">
                  <div className="flex gap-2 flex-wrap justify-center">
                    {kicksA_row1.map((result, i) => renderIcon(result, `a1-${i}`))}
                  </div>
                  {kicksA_row2.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-center">
                      {kicksA_row2.map((result, i) => renderIcon(result, `a2-${i}`))}
                    </div>
                  )}
              </div>
              <div className="text-4xl font-bold text-[#009B3A]">{shootout.scoreA}</div>
            </div>
            <div className="text-2xl text-gray-400 font-bold pt-10">vs</div>
            <div className="flex flex-col items-center gap-3 flex-1">
              <span className="text-lg font-bold text-[#091F40] text-center">{teamB.name}</span>
              <div className="flex flex-col gap-2 items-center">
                  <div className="flex gap-2 flex-wrap justify-center">
                    {kicksB_row1.map((result, i) => renderIcon(result, `b1-${i}`))}
                  </div>
                  {kicksB_row2.length > 0 && (
                    <div className="flex gap-2 flex-wrap justify-center">
                      {kicksB_row2.map((result, i) => renderIcon(result, `b2-${i}`))}
                    </div>
                  )}
              </div>
              <div className="text-4xl font-bold text-[#009B3A]">{shootout.scoreB}</div>
            </div>
          </div>
          <div className="text-center">
            {isFinished ? (
              <p className="text-xl font-bold text-[#009B3A]">¡GANADOR: {(shootout.winner === 'A' ? teamA.name : teamB.name).toUpperCase()}!</p>
            ) : (
              <Button onClick={onKick} disabled={shootout.isKicking} className="bg-[#091F40] hover:bg-[#06152b] shadow-slate-300 text-lg px-8 py-3">
                {shootout.isKicking ? 'Pateando...' : `Patear (${kickerName})`}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const MatchDetail = ({ match, onBack }) => {
      const [showLiveOdds, setShowLiveOdds] = useState(false);
      const teamA = teams.find(t => t.id === match.teamAId);
      const teamB = teams.find(t => t.id === match.teamBId);
      const stats = match.stats || { possession: 50, shotsA: 0, shotsB: 0, onTargetA: 0, onTargetB: 0, foulsA: 0, foulsB: 0, yellowA: 0, yellowB: 0, redA: 0, redB: 0, cornersA: 0, cornersB: 0 };
      const [seconds, setSeconds] = useState(0);
      
      const isMatchLive = match.status === 'live' || match.status === 'halftime';
      const isMatchFinished = match.status === 'finished' || match.status === 'penalties';

      // --- LIVE ODDS CALCULATION ---
      const odds = useMemo(() => {
          if (showLiveOdds && isMatchLive) {
              return calculateOdds(teamA, teamB, match.currentMinute, match.scoreA, match.scoreB);
          }
          return match.initialOdds || { home: '-', draw: '-', away: '-' };
      }, [showLiveOdds, match.scoreA, match.scoreB, match.currentMinute, teamA, teamB, isMatchLive]);

      useEffect(() => {
        let timerId = null;
        if (match.status === 'live' && timeScale === 60000) {
          timerId = setInterval(() => { setSeconds(prevSeconds => (prevSeconds + 1) % 60); }, 1000); 
        }
        return () => { if (timerId) clearInterval(timerId); setSeconds(0); };
      }, [match.status, timeScale]);
      useEffect(() => { setSeconds(0); }, [match.currentMinute]);
      let timeDisplay = "";
      const displayMinute = String(match.currentMinute).padStart(2, '0');
      const displaySeconds = (timeScale === 60000 && match.status === 'live' && match.currentMinute < 45) || (timeScale === 60000 && match.status === 'live' && match.currentMinute >= 45 && match.currentMinute < 90) ? String(seconds).padStart(2, '0') : '00';
      timeDisplay = `${displayMinute}:${displaySeconds}`;
      if (match.status === 'halftime') {
          const remaining = 15 - (match.halftimeCounter || 0);
          timeDisplay = `MT (${String(remaining).padStart(2, '0')}:00)`;
      } else if (match.status === 'penalties') {
          timeDisplay = "PENALES";
      } else if (match.status === 'finished' && match.penaltyShootout) {
          timeDisplay = "PENALES (F)";
      } else if ((match.period === '1T' && match.currentMinute > 45) || (match.period === '2T' && match.currentMinute > 90)) {
          const regular = match.period === '1T' ? 45 : 90;
          const added = match.currentMinute - regular;
          timeDisplay = `${String(regular).padStart(2, '0')}+${String(added).padStart(2, '0')}`;
      }
      
      let globalScore = null;
      if (match.matchType === 'leg1' || match.matchType === 'leg2') {
          const leg1 = matches.find(m => m.seriesId === match.seriesId && m.matchType === 'leg1');
          const leg2 = matches.find(m => m.seriesId === match.seriesId && m.matchType === 'leg2');
          const aggA = (leg1 ? leg1.scoreA : 0) + (leg2 ? leg2.scoreB : 0);
          const aggB = (leg1 ? leg1.scoreB : 0) + (leg2 ? leg2.scoreA : 0);
          let displayAggA = aggA;
          let displayAggB = aggB;
          if (match.matchType === 'leg2') {
              displayAggA = aggB;
              displayAggB = aggA;
          }
          globalScore = {
              label: (match.matchType === 'leg1' && match.status === 'scheduled' && (!leg1 || leg1.status === 'scheduled')) ? '(GLOBAL 0-0)' : `(GLOBAL ${displayAggA}-${displayAggB})`
          };
      }
      
      const isFinished = match.status === 'finished';
      let scoreOpacityA = 'opacity-100';
      let scoreOpacityB = 'opacity-100';
      if (isFinished) {
          let winner = null;
          if (match.penaltyShootout && match.penaltyShootout.winner) {
            winner = match.penaltyShootout.winner;
          } else if (match.matchType === 'leg2' || (match.matchType === 'leg1' && globalScore)) {
            const leg1 = matches.find(m => m.seriesId === match.seriesId && m.matchType === 'leg1');
            const leg2 = matches.find(m => m.seriesId === match.seriesId && m.matchType === 'leg2');
            const aggA = (leg1 ? leg1.scoreA : 0) + (leg2 ? leg2.scoreB : 0);
            const aggB = (leg1 ? leg1.scoreB : 0) + (leg2 ? leg2.scoreA : 0);
            if (aggA > aggB) winner = 'A_GLOBAL';
            if (aggB > aggA) winner = 'B_GLOBAL';
            if (match.matchType === 'leg1') {
                if (winner === 'A_GLOBAL') winner = 'A';
                if (winner === 'B_GLOBAL') winner = 'B';
            } else {
                if (winner === 'A_GLOBAL') winner = 'B';
                if (winner === 'B_GLOBAL') winner = 'A';
            }
          } else {
            if (match.scoreA > match.scoreB) winner = 'A';
            if (match.scoreB > match.scoreA) winner = 'B';
          }
          if (winner === 'B') scoreOpacityA = 'opacity-50';
          if (winner === 'A') scoreOpacityB = 'opacity-50';
      }
      
      let tournamentLabel = null;
      if (match.tournamentId) {
          if (match.groupName) {
              tournamentLabel = `${match.groupName}${match.jornada ? ` - J${match.jornada}` : ' - Fase de Grupos'}`;
          } else if (match.stageName) {
              tournamentLabel = match.stageName; 
          } else {
              tournamentLabel = "Fase Eliminatoria";
          }
      }
      
      return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
              <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-lg border-l-4 border-l-[#091F40] shadow-sm">
                <button onClick={onBack} className="text-[#091F40] hover:text-[#009B3A] flex items-center gap-2 text-sm font-bold uppercase">← Volver</button>
                {match.status !== 'penalties' && !(match.status === 'finished' && match.penaltyShootout) && (
                  <div className="flex gap-1">
                    {[60000, 2000, 1000, 50].map(speed => (
                        <button key={speed} onClick={() => setTimeScale(speed)} className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-colors ${timeScale === speed ? 'bg-[#F58220] text-white' : 'bg-slate-100 text-[#091F40] hover:bg-slate-200'}`}>
                            {speed === 60000 ? 'x1' : speed === 2000 ? 'x30' : speed === 1000 ? 'x60' : '⚡'}
                        </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gradient-to-r from-[#009B3A] to-[#091F40] rounded-t-2xl border-b-4 border-[#F58220] p-6 md:p-8 text-center relative overflow-hidden shadow-xl">
                  <div className="absolute top-3 right-3 z-20 text-white/70 text-[10px] font-bold uppercase">{formatDate(match.startTime)}</div>

                  {match.matchType === 'leg1' && <div className="absolute top-3 left-3 z-20 bg-white/20 text-white text-xs font-bold uppercase px-2 py-1 rounded">Partido de Ida</div>}
                  {match.matchType === 'leg2' && <div className="absolute top-3 left-3 z-20 bg-white/20 text-white text-xs font-bold uppercase px-2 py-1 rounded">Partido de Vuelta</div>}
                  {tournamentLabel && <div className="absolute top-3 left-3 z-20 bg-white/20 text-white text-xs font-bold uppercase px-2 py-1 rounded">{tournamentLabel}</div>}
                  
                  <div className="flex justify-between items-center max-w-4xl mx-auto relative z-10">
                      <div className="flex flex-col items-center w-1/3">
                           <img src={teamA?.logo || `https://ui-avatars.com/api/?name=${teamA?.name}`} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white shadow-lg bg-white object-cover" />
                           <h2 className="text-lg md:text-2xl font-bold text-white mt-4 tracking-tight leading-none drop-shadow-md">{teamA?.name}</h2>
                      </div>
                      <div className="flex flex-col items-center w-1/3">
                          <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20">
                              {match.status === 'scheduled' ? (
                                <div className="text-4xl md:text-6xl font-sans font-bold text-white tracking-tighter drop-shadow-lg">VS</div>
                              ) : (
                                <div className="text-4xl md:text-6xl font-sans font-bold text-white tracking-tighter flex items-center justify-center gap-2 drop-shadow-lg">
                                  <span className={`transition-opacity duration-500 ${scoreOpacityA}`}>{match.scoreA}</span>
                                  <span className="text-white/50 text-3xl">-</span>
                                  <span className={`transition-opacity duration-500 ${scoreOpacityB}`}>{match.scoreB}</span>
                                </div>
                              )}
                          </div>
                          {globalScore && (
                              <div className="mt-2 text-yellow-300 font-bold text-sm bg-black/20 px-2 py-0.5 rounded whitespace-nowrap">{globalScore.label}</div>
                          )}
                          <div className="mt-4 flex flex-col items-center gap-2">
                              <Badge status={match.status} period={match.period} />
                              {match.status !== 'scheduled' && (
                                <div className="flex items-center gap-2 text-yellow-300 font-mono text-xl font-bold drop-shadow">
                                    {(match.status !== 'penalties' && !(match.status === 'finished' && match.penaltyShootout)) && <Clock size={20} />} 
                                    {timeDisplay}
                                </div>
                              )}
                          </div>
                      </div>
                      <div className="flex flex-col items-center w-1/3">
                           <img src={teamB?.logo || `https://ui-avatars.com/api/?name=${teamB?.name}`} className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-white shadow-lg bg-white object-cover" />
                           <h2 className="text-lg md:text-2xl font-bold text-white mt-4 tracking-tight leading-none drop-shadow-md">{teamB?.name}</h2>
                      </div>
                  </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-4">
                  {(match.status === 'penalties' || (match.status === 'finished' && match.penaltyShootout)) ? (
                    <PenaltyShootoutUI match={match} onKick={() => handlePenaltyKick(match)} />
                  ) : (
                    <>
                      <div className="lg:col-span-4 space-y-4">
                          {/* --- NUEVO: Panel de Cuotas con colores del logo --- */}
                          <div className="bg-[#091F40] text-white rounded-xl p-4 shadow-lg border border-[#009B3A]">
                              <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-700">
                                  <h3 className="text-xs font-bold uppercase flex items-center gap-2 text-[#F58220]">
                                      <TrendingUp size={14} /> Probabilidades & Cuotas
                                  </h3>
                                  <div className="flex bg-gray-800 rounded-lg p-0.5">
                                      <button 
                                        onClick={() => setShowLiveOdds(false)}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${!showLiveOdds ? 'bg-[#F58220] text-white' : 'text-gray-400 hover:text-white'}`}
                                      >
                                          Initial Odds
                                      </button>
                                      <button 
                                        onClick={() => setShowLiveOdds(true)}
                                        disabled={!isMatchLive}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${showLiveOdds ? 'bg-[#EF4135] text-white animate-pulse' : 'text-gray-400'} ${!isMatchLive && 'opacity-30 cursor-not-allowed'}`}
                                      >
                                          Live Odds
                                      </button>
                                  </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-center">
                                  <div className="bg-[#06152b] p-2 rounded-lg border border-[#009B3A]/30 hover:border-[#009B3A] transition-colors">
                                      <div className="text-[10px] text-gray-400 font-bold mb-1 truncate">{teamA.name}</div>
                                      <div className="text-xl font-mono font-bold text-[#009B3A]">{odds.home}</div>
                                      <div className="text-[9px] text-gray-500">{odds.probs?.w}%</div>
                                  </div>
                                  <div className="bg-[#06152b] p-2 rounded-lg border border-[#F58220]/30 hover:border-[#F58220] transition-colors">
                                      <div className="text-[10px] text-gray-400 font-bold mb-1">EMPATE</div>
                                      <div className="text-xl font-mono font-bold text-[#F58220]">{odds.draw}</div>
                                      <div className="text-[9px] text-gray-500">{odds.probs?.d}%</div>
                                  </div>
                                  <div className="bg-[#06152b] p-2 rounded-lg border border-[#EF4135]/30 hover:border-[#EF4135] transition-colors">
                                      <div className="text-[10px] text-gray-400 font-bold mb-1 truncate">{teamB.name}</div>
                                      <div className="text-xl font-mono font-bold text-[#EF4135]">{odds.away}</div>
                                      <div className="text-[9px] text-gray-500">{odds.probs?.l}%</div>
                                  </div>
                              </div>
                              {showLiveOdds && (
                                  <div className="mt-3 text-[10px] text-center text-gray-500 italic flex items-center justify-center gap-1">
                                      <Activity size={10} className="text-[#EF4135]" />
                                      Actualizando probabilidades en tiempo real...
                                  </div>
                              )}
                          </div>

                          <div className="bg-white border-l-4 border-l-[#091F40] rounded-xl p-6 shadow-sm">
                              <h3 className="text-[#091F40] uppercase text-xs font-bold mb-6 flex items-center gap-2 border-b border-gray-100 pb-2">
                                  <Activity size={14} className="text-[#EF4135]" /> Datos del Partido
                              </h3>
                              <div className="space-y-5">
                                <div className="mb-6">
                                    <div className="flex justify-between text-2xl font-mono font-bold text-[#091F40] mb-2">
                                        <span className="text-[#009B3A]">{stats.possession}%</span>
                                        <span className="text-[10px] font-sans text-gray-400 font-bold self-center uppercase">Posesión</span>
                                        <span className="text-[#F58220]">{100 - stats.possession}%</span>
                                    </div>
                                    <div className="flex h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                        <div className="bg-[#009B3A]" style={{ width: `${stats.possession}%` }}></div>
                                        <div className="bg-[#F58220]" style={{ width: `${100 - stats.possession}%` }}></div>
                                    </div>
                                </div>
                                <StatRow label="Tiros" valA={stats.shotsA} valB={stats.shotsB} total={stats.shotsA + stats.shotsB} />
                                <StatRow label="Al Arco" valA={stats.onTargetA} valB={stats.onTargetB} total={stats.onTargetA + stats.onTargetB} />
                                <StatRow label="Córners" valA={stats.cornersA} valB={stats.cornersB} total={stats.cornersA + stats.cornersB} />
                                <div className="my-4 border-t border-gray-100 border-dashed"></div>
                                <StatRow label="Faltas" valA={stats.foulsA} valB={stats.foulsB} total={stats.foulsA + stats.foulsB} />
                                <StatRow label="Amarillas" valA={stats.yellowA} valB={stats.yellowB} total={stats.yellowA + stats.yellowB} />
                                <StatRow label="Rojas" valA={stats.redA} valB={stats.redB} total={stats.redA + stats.redB} />
                              </div>
                          </div>
                          {match.status !== 'finished' && (
                            <div className="bg-white border-l-4 border-l-[#009B3A] rounded-xl p-4 shadow-sm flex flex-col gap-2">
                                {match.status === 'scheduled' && <Button onClick={() => startMatch(match)} className="w-full"><Play size={14}/> Iniciar Partido</Button>}
                                {(match.status === 'live' || match.status === 'halftime') && <Button variant="secondary" onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', match.id), { status: 'finished' })} className="w-full text-[#EF4135] border-[#EF4135] hover:bg-red-50">Terminar Partido</Button>}
                                <div className="flex gap-2 mt-2">
                                    <button onClick={() => updateMatchScoreManual(match.id, 'A', 1)} className="flex-1 bg-green-50 hover:bg-green-100 text-[#009B3A] text-xs font-bold py-2 rounded border border-green-200">+ GOL LOC</button>
                                    <button onClick={() => updateMatchScoreManual(match.id, 'B', 1)} className="flex-1 bg-green-50 hover:bg-green-100 text-[#009B3A] text-xs font-bold py-2 rounded border border-green-200">+ GOL VIS</button>
                                </div>
                            </div>
                          )}
                      </div>
                      <div className="lg:col-span-8 bg-white border-l-4 border-l-[#F58220] rounded-xl overflow-hidden flex flex-col h-[600px] shadow-sm">
                          <div className="bg-slate-50 p-3 border-b border-slate-100"><h3 className="text-[#091F40] font-bold text-xs uppercase flex items-center gap-2"><Timer size={14} /> Minuto a Minuto</h3></div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                              {[...match.events].reverse().map((ev, idx) => (
                                  <div key={idx} className={`flex items-start gap-3 p-3 rounded border shadow-sm ${ev.type === 'goal' ? 'bg-orange-50 border-orange-200' : (ev.type === 'whistle' ? 'bg-slate-50 border-slate-200' : 'bg-white border-gray-100')}`}>
                                      <div className="text-[#009B3A] font-mono font-bold text-sm min-w-[32px] text-right">{ev.minute}'</div>
                                      <div className="flex-1"><p className={`text-sm font-medium ${ev.type === 'goal' ? 'text-[#091F40] font-black' : (ev.type === 'whistle' ? 'text-[#009B3A] font-bold' : 'text-gray-600')}`}>{ev.text}</p></div>
                                  </div>
                              ))}
                          </div>
                      </div>
                    </>
                  )}
              </div>
          </div>
      )
  };

  const MatchCard = ({ match, onClick, onDelete, onEditDate }) => {
      const teamA = teams.find(t => t.id === match.teamAId);
      const teamB = teams.find(t => t.id === match.teamBId);
      const teamADisplay = teamA?.shortName || teamA?.name.substring(0, 5) || 'LOC';
      const teamBDisplay = teamB?.shortName || teamB?.name.substring(0, 5) || 'VIS';
      let scoreOpacityA = 'opacity-100';
      let scoreOpacityB = 'opacity-100';
      if (match.status === 'finished') {
          let winner = null;
          if (match.penaltyShootout && match.penaltyShootout.winner) { winner = match.penaltyShootout.winner; } 
          else if (match.matchType === 'leg2') {
              const leg1 = matches.find(m => m.seriesId === match.seriesId && m.matchType === 'leg1');
              if(leg1) {
                  const aggA = leg1.scoreA + match.scoreB;
                  const aggB = leg1.scoreB + match.scoreA;
                  if (aggA > aggB) winner = 'B'; 
                  if (aggB > aggA) winner = 'A';
              }
          }
          else if (match.matchType === 'single' || match.matchType === 'group' || match.matchType === 'knockout') { 
              if (match.scoreA > match.scoreB) winner = 'A';
              if (match.scoreB > match.scoreA) winner = 'B';
          }
          if (winner === 'B') scoreOpacityA = 'opacity-50';
          if (winner === 'A') scoreOpacityB = 'opacity-50';
      }
      
      let timeLabel = "";
      if (match.status === 'scheduled') {
          timeLabel = formatDate(match.startTime);
      } else if (match.status === 'penalties') { timeLabel = "PEN"; }
      else if (match.status === 'finished' && match.penaltyShootout) { timeLabel = "PEN(F)"; }
      else if (match.status !== 'finished') {
          if (match.status === 'halftime') { timeLabel = "MT"; }
          else if ((match.period === '1T' && match.currentMinute > 45) || (match.period === '2T' && match.currentMinute > 90)) {
              const regular = match.period === '1T' ? 45 : 90;
              const added = match.currentMinute - regular;
              timeLabel = `${String(regular).padStart(2, '0')}+${String(added).padStart(2, '0')}`;
          } else { timeLabel = `${String(match.currentMinute).padStart(2, '0')}:00`; }
      } else {
          timeLabel = formatDate(match.startTime);
      }

      let globalLabel = null;
      if (match.matchType === 'leg1' || match.matchType === 'leg2') {
          const leg1 = matches.find(m => m.seriesId === match.seriesId && m.matchType === 'leg1');
          const leg2 = matches.find(m => m.seriesId === match.seriesId && m.matchType === 'leg2');
          const aggA = (leg1 ? leg1.scoreA : 0) + (leg2 ? leg2.scoreB : 0);
          const aggB = (leg1 ? leg1.scoreB : 0) + (leg2 ? leg2.scoreA : 0);
          let displayAggA = aggA, displayAggB = aggB;
          if (match.matchType === 'leg2') {
              displayAggA = aggB;
              displayAggB = aggA;
          }
          if (match.status !== 'scheduled' || (leg1 && leg1.status === 'finished')) {
             globalLabel = `Global: ${displayAggA}-${displayAggB}`;
          }
      }
      
      let tournamentLabel = null;
      if (match.tournamentId) {
          if (match.groupName) {
              tournamentLabel = `${match.groupName}${match.jornada ? ` - J${match.jornada}` : ''}`;
          } else if (match.stageName) {
              tournamentLabel = match.stageName; 
          } else {
              tournamentLabel = "Eliminatoria";
          }
      }

      return (
          <div onClick={onClick} className="p-4 hover:bg-slate-50 transition-all cursor-pointer group relative overflow-hidden rounded-xl border-l-4 border-l-[#091F40] bg-white shadow-sm">
              {(match.status === 'live' || match.status === 'penalties') && <div className={`absolute left-0 top-0 bottom-0 w-1 ${match.status === 'live' ? 'bg-[#EF4135]' : 'bg-[#009B3A]'}`}></div>}
              
              <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  {/* --- NUEVO: Botón editar fecha --- */}
                  <button onClick={(e) => { e.stopPropagation(); onEditDate(match.id, match.startTime); }}
                      className="text-gray-300 hover:text-[#009B3A] p-1.5 bg-white/80 rounded-full shadow-sm">
                      <Pencil size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(match.id); }}
                      className="text-gray-300 hover:text-[#EF4135] p-1.5 bg-white/80 rounded-full shadow-sm">
                      <Trash2 size={14} />
                  </button>
              </div>

              <div className="flex justify-between items-center mb-1 pl-2">
                  <Badge status={match.status} period={match.period} />
                  <span className="text-xs text-gray-500 font-mono font-bold uppercase">{timeLabel}</span>
              </div>
              <div className="flex justify-between items-center mb-4 pl-2 text-xs text-[#009B3A] font-bold h-4">
                 <span className="truncate">
                    {match.matchType === 'leg1' && 'IDA'}
                    {match.matchType === 'leg2' && 'VUELTA'}
                    {tournamentLabel}
                 </span>
                 <span className="whitespace-nowrap flex-shrink-0">
                    {globalLabel}
                 </span>
              </div>
              <div className="flex items-center justify-between pl-2">
                  <div className="flex items-center gap-3 w-1/3">
                      <img src={teamA?.logo || `https://ui-avatars.com/api/?name=${teamA?.name}`} className="w-8 h-8 rounded-full bg-white border object-cover" />
                      <span className="font-bold text-[#091F40] text-sm truncate">{teamADisplay}</span>
                  </div>
                  <div className="font-sans font-bold text-2xl text-[#091F40] bg-slate-50 px-4 py-1 rounded-lg border border-slate-100 whitespace-nowrap flex-shrink-0 min-w-[80px] text-center">
                    {match.status === 'scheduled' ? (
                      <span className="text-xl text-[#009B3A]">VS</span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span className={`transition-opacity duration-500 ${scoreOpacityA}`}>{match.scoreA}</span>
                        <span>-</span>
                        <span className={`transition-opacity duration-500 ${scoreOpacityB}`}>{match.scoreB}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 w-1/3 justify-end">
                      <span className="font-bold text-[#091F40] text-sm truncate">{teamBDisplay}</span>
                      <img src={teamB?.logo || `https://ui-avatars.com/api/?name=${teamB?.name}`} className="w-8 h-8 rounded-full bg-white border object-cover" />
                  </div>
              </div>
          </div>
      );
  };

  const DashboardView = () => {
    const liveMatches = matches.filter(m => m.status === 'live' || m.status === 'halftime' || m.status === 'penalties');
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#009B3A] to-[#06152b] p-8 shadow-xl text-white mb-8 border-b-4 border-[#F58220]">
            <div className="relative z-10">
                <div className="flex items-center gap-2 text-[#F58220] font-bold uppercase tracking-widest text-sm mb-2"><img 
  src="https://i.postimg.cc/T1xy0cy4/IMG-4967.png" 
  className="w-14 h-14 object-contain"
  alt="Logo"
/> Edición Táctica</div>
                <h2 className="text-3xl md:text-5xl font-black italic tracking-tighter mb-2">COPA DE LOS <span className="text-[#EF4135] bg-white px-2 skew-x-[-10deg] inline-block">REYES</span> 2026</h2>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-5 border-l-4 border-l-[#EF4135] bg-white shadow-sm">
             <div className="flex justify-between"><p className="text-gray-400 text-xs font-bold uppercase">En Juego</p><p className="text-3xl font-bold text-[#091F40]">{liveMatches.length}</p></div>
          </Card>
          <Card className="p-5 border-l-4 border-l-[#009B3A] bg-white shadow-sm">
             <div className="flex justify-between"><p className="text-gray-400 text-xs font-bold uppercase">Programados</p><p className="text-3xl font-bold text-[#091F40]">{matches.filter(m => m.status === 'scheduled').length}</p></div>
          </Card>
          <Card className="p-5 border-l-4 border-l-[#F58220] bg-white shadow-sm">
             <div className="flex justify-between"><p className="text-gray-400 text-xs font-bold uppercase">Clubes</p><p className="text-3xl font-bold text-[#091F40]">{teams.length}</p></div>
          </Card>
        </div>
      </div>
    );
  };

  const TeamsView = () => {
    const [isEditing, setIsEditing] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState(null); 
    const [formData, setFormData] = useState({ name: '', shortName: '', logo: '', probability: 0.5, style: 'balanced' });

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        if (!user) return; 
        
        if (editingTeamId) {
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', editingTeamId), formData);
        } else {
            const roster = generateRoster();
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'teams'), { ...formData, roster, createdAt: serverTimestamp() }); 
        }
        
        resetForm();
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditingTeamId(null);
        setFormData({ name: '', shortName: '', logo: '', probability: 0.5, style: 'balanced' });
    };

    const handleEditTeam = (team) => {
        setFormData({
            name: team.name,
            shortName: team.shortName,
            logo: team.logo,
            probability: team.probability,
            style: team.style
        });
        setEditingTeamId(team.id);
        setIsEditing(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
      <div>
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-[#091F40]">Clubes Registrados</h2>
            <Button onClick={() => { if(isEditing) resetForm(); else setIsEditing(true); }}>
                {isEditing ? 'Cancelar' : <><Plus size={16} /> Nuevo Club</>}
            </Button>
        </div>
        {isEditing && (
          <Card className="p-6 mb-6 bg-white shadow-lg animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-4 text-[#009B3A] font-bold border-b pb-2">
                {editingTeamId ? <><Edit size={16}/> Editar Club</> : <><Plus size={16}/> Crear Nuevo Club</>}
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <Input label="Nombre Completo" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="md:col-span-2" />
               <Input label="Abreviatura (3 letras)" value={formData.shortName} onChange={e => setFormData({...formData, shortName: e.target.value.toUpperCase().substring(0, 3)})} maxLength={3} />
               <Input label="Logo URL" value={formData.logo} onChange={e => setFormData({...formData, logo: e.target.value})} />
               <Select label="Estilo" value={formData.style} onChange={e => setFormData({...formData, style: e.target.value})} options={[{ value: 'balanced', label: 'Equilibrado' }, { value: 'possession', label: 'Posesión' }, { value: 'counter', label: 'Contraataque' }]} />
               <div>
                   <label className="text-[10px] uppercase tracking-widest text-[#009B3A] font-bold mb-1 block">Fuerza: {Math.round(formData.probability*100)}%</label>
                   <input type="range" min="0.1" max="1.0" step="0.01" className="w-full h-2 bg-green-100 rounded-lg accent-green-600" value={formData.probability} onChange={e => setFormData({...formData, probability: parseFloat(e.target.value)})} />
               </div>
               <Button type="submit" className="md:col-span-3">{editingTeamId ? 'Guardar Cambios' : 'Crear Equipo'}</Button>
            </form>
          </Card>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{teams.map(t => (
            <div key={t.id} className="bg-white border border-green-100 p-4 rounded-lg shadow-sm flex flex-col gap-3 group">
                <div className="flex items-center gap-4">
                    <img src={t.logo || `https://ui-avatars.com/api/?name=${t.name}`} className="w-12 h-12 rounded-full shadow-sm object-cover" />
                    <div className="flex-1">
                        <div className="font-bold text-sm text-[#091F40]">{t.name} ({t.shortName || 'N/A'})</div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase">{t.style}</div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleEditTeam(t); }} className="text-gray-400 hover:text-[#009B3A] p-2 bg-gray-50 hover:bg-green-50 rounded-full transition-colors"> <Pencil size={14}/> </button>
                        <button onClick={(e) => { e.stopPropagation(); setDeleteTeamId(t.id); }} className="text-gray-400 hover:text-[#EF4135] p-2 bg-gray-50 hover:bg-red-50 rounded-full transition-colors"> <Trash2 size={14}/> </button>
                    </div>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#009B3A]" style={{width: `${t.probability*100}%`}}></div></div>
            </div>
        ))}</div>
      </div>
    );
  };

  const MatchCardWrapper = ({ match, allMatches, onClick, onDelete, onEditDate }) => {
    if (match.matchType === 'leg2') {
        return null; 
    }

    if (match.matchType === 'leg1') {
      const leg2 = allMatches.find(m => m.seriesId === match.seriesId && m.matchType === 'leg2');
      return (
        <div className="bg-white border border-green-100 rounded-xl shadow-sm overflow-hidden divide-y divide-green-100">
          <MatchCard match={match} onClick={() => onClick(match.id)} onDelete={onDelete} onEditDate={onEditDate} />
          {leg2 && ( <MatchCard match={leg2} onClick={() => onClick(leg2.id)} onDelete={onDelete} onEditDate={onEditDate} /> )}
        </div>
      );
    }
    
    return (
      <div className="bg-white border border-green-100 rounded-xl shadow-sm overflow-hidden">
        <MatchCard match={match} onClick={() => onClick(match.id)} onDelete={onDelete} onEditDate={onEditDate} />
      </div>
    );
  };

  const MatchesView = () => {
    const [isScheduling, setIsScheduling] = useState(false);
    const [formData, setFormData] = useState({ teamAId: '', teamBId: '', startTime: '', startTimeLeg2: '', matchType: 'single', autoStart: true });
    
    const handleSchedule = async (e) => { 
        e.preventDefault(); 
        if (!user) return;
        
        let initialOdds = { home: '-', draw: '-', away: '-' };
        if (formData.teamAId && formData.teamBId) {
            const tA = teams.find(t => t.id === formData.teamAId);
            const tB = teams.find(t => t.id === formData.teamBId);
            initialOdds = calculateOdds(tA, tB);
        }

        const baseData = { 
            status: 'scheduled', 
            scoreA: 0, scoreB: 0, 
            currentMinute: 0, 
            events: [], 
            period: '1T', 
            addedTime: 0, 
            halftimeCounter: 0, 
            createdAt: serverTimestamp(), 
            autoStart: formData.autoStart, 
            tournamentId: null, 
            groupId: null, 
            groupName: null, 
            jornada: null, 
            seriesId: null, 
            matchType: 'single',
            initialOdds: initialOdds 
        };

        if (formData.matchType === 'single') {
            if (!formData.teamAId || !formData.teamBId || !formData.startTime) return;
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'matches'), { ...baseData, teamAId: formData.teamAId, teamBId: formData.teamBId, startTime: formData.startTime });
        } else {
            if (!formData.teamAId || !formData.teamBId || !formData.startTime || !formData.startTimeLeg2) return;
            const seriesId = `series-${crypto.randomUUID()}`;
            const batch = writeBatch(db);
            const matchesCollection = collection(db, 'artifacts', appId, 'public', 'data', 'matches');
            const leg1Ref = doc(matchesCollection);
            batch.set(leg1Ref, { ...baseData, teamAId: formData.teamAId, teamBId: formData.teamBId, startTime: formData.startTime, matchType: 'leg1', seriesId: seriesId });
            const leg2Ref = doc(matchesCollection);
            const initialOddsLeg2 = calculateOdds(teams.find(t=>t.id===formData.teamBId), teams.find(t=>t.id===formData.teamAId));
            batch.set(leg2Ref, { ...baseData, teamAId: formData.teamBId, teamBId: formData.teamAId, startTime: formData.startTimeLeg2, matchType: 'leg2', seriesId: seriesId, initialOdds: initialOddsLeg2 });
            await batch.commit();
        }
        setIsScheduling(false); 
        setFormData({ teamAId: '', teamBId: '', startTime: '', startTimeLeg2: '', matchType: 'single', autoStart: true });
    };
    
    const matchesToDisplay = matches.filter(m => m.matchType !== 'leg2');

    return (
      <div>
         <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-[#091F40]">Calendario de Partidos</h2><Button onClick={() => setIsScheduling(!isScheduling)}>{isScheduling ? 'Cancelar' : <><Calendar size={16} /> Programar Partido</>}</Button></div>
         {isScheduling && <Card className="p-6 mb-6 shadow-lg animate-in slide-in-from-top-2"><form onSubmit={handleSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Tipo de Partido" options={[{value:'single', label:'Partido Único'}, {value:'twoLegged', label:'Ida y Vuelta'}]} value={formData.matchType} onChange={e=>setFormData({...formData, matchType: e.target.value})} className="md:col-span-2" />
            <Select label="Equipo Local (Ida)" options={[{value:'', label:'Local...'}, ...teams.map(t => ({value:t.id, label:t.name}))]} value={formData.teamAId} onChange={e=>setFormData({...formData, teamAId: e.target.value})} />
            <Select label="Equipo Visitante (Ida)" options={[{value:'', label:'Visita...'}, ...teams.filter(t=>t.id!==formData.teamAId).map(t => ({value:t.id, label:t.name}))]} value={formData.teamBId} onChange={e=>setFormData({...formData, teamBId: e.target.value})} />
            <Input label={formData.matchType === 'single' ? 'Fecha y Hora' : 'Fecha Partido Ida'} type="datetime-local" value={formData.startTime} onChange={e=>setFormData({...formData, startTime: e.target.value})} className={formData.matchType === 'single' ? 'md:col-span-2' : ''} />
            {formData.matchType === 'twoLegged' && ( <Input label="Fecha Partido Vuelta" type="datetime-local" value={formData.startTimeLeg2} onChange={e=>setFormData({...formData, startTimeLeg2: e.target.value})} /> )}
            <label className="flex items-center gap-2 text-sm text-[#009B3A] font-bold md:col-span-2"><input type="checkbox" checked={formData.autoStart} onChange={e=>setFormData({...formData, autoStart: e.target.checked})} className="accent-[#009B3A] w-4 h-4" /> Iniciar partidos automáticamente</label>
            <Button type="submit" className="md:col-span-2">Confirmar</Button>
         </form></Card>}
         <div className="grid gap-3">{matchesToDisplay.map(m => (
             <MatchCardWrapper 
                key={m.id} 
                match={m} 
                allMatches={matches} 
                onClick={setSelectedMatchId} 
                onDelete={(id) => setDeleteMatchId(id)} 
                onEditDate={(id, date) => { setEditDateMatchId(id); setEditDateCurrent(date); }}
             />
         ))}</div>
      </div>
    );
  };
  
  const TournamentsView = ({ tournaments, allTeams, allMatches, user, onDeleteClick }) => {
    const reyesTournament = tournaments.find(t => t.name === "COPA DE LOS REYES 2026");

    const handleCreateReyesCup = async () => {
        if (!user) return;
        
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'tournaments'), {
            name: "COPA DE LOS REYES 2026",
            createdAt: serverTimestamp(),
            groups: [], 
            knockout: null 
        });
    };
    
    if (reyesTournament) {
        return (
            <TournamentDetailView 
                tournament={reyesTournament}
                onBack={() => {}} 
                user={user}
                allTeams={allTeams}
                allMatches={allMatches}
                onDeleteTournament={onDeleteClick}
                isSingleMode={true}
            />
        );
    }

    return (
        <div className="animate-in fade-in duration-300 flex flex-col items-center justify-center h-[500px]">
            <Crown size={64} className="text-[#F58220] mb-4" />
            <h2 className="text-3xl font-bold text-[#091F40] mb-2">Copa de los Reyes 2026</h2>
            <p className="text-gray-500 mb-6 text-center max-w-md">La competición aún no ha sido inicializada. Haz clic abajo para comenzar la organización del torneo.</p>
            <Button onClick={handleCreateReyesCup} className="text-lg px-8 py-3">
                <Plus size={20} /> Inicializar Copa
            </Button>
        </div>
    );
  };
  
  const TournamentDetailView = ({ tournament, onBack, user, allTeams, allMatches, onDeleteTournament, isSingleMode }) => {
    const [view, setView] = useState('groups'); 
    const [isEditMode, setIsEditMode] = useState(true); 
    const [isResetting, setIsResetting] = useState(false); // Estado para el modal de reset
    
    const [groupForm, setGroupForm] = useState({ name: '', classifiedSlots: 2 });
    const [teamToAdd, setTeamToAdd] = useState({ groupId: null, teamId: '' });
    const [matchForm, setMatchForm] = useState({ groupId: null, teamAId: '', teamBId: '', startTime: '', jornada: '' });
    
    const [knockoutSetup, setKnockoutSetup] = useState(tournament.knockout ? tournament.knockout.type : 8);
    const [thirdPlace, setThirdPlace] = useState(false); 
    const [koMatchDates, setKoMatchDates] = useState({}); 

    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'tournaments', tournament.id);

    const handleAddGroup = async () => {
        if (!groupForm.name.trim()) return;
        const newGroup = {
            id: `group-${crypto.randomUUID()}`,
            name: groupForm.name,
            teams: [],
            settings: { classifiedSlots: parseInt(groupForm.classifiedSlots, 10) }
        };
        await updateDoc(docRef, { groups: arrayUnion(newGroup) });
        setGroupForm({ name: '', classifiedSlots: 2 });
    };

    const handleAddTeamToGroup = async (groupId) => {
        if (!teamToAdd.teamId || !groupId) return;
        
        const newGroups = tournament.groups.map(g => {
            if (g.id === groupId) {
                if (g.teams.includes(teamToAdd.teamId)) return g;
                return { ...g, teams: [...g.teams, teamToAdd.teamId] };
            }
            return g;
        });
        
        await updateDoc(docRef, { groups: newGroups });
        setTeamToAdd({ groupId: null, teamId: '' });
    };

    const handleRemoveTeamFromGroup = async (groupId, teamId) => {
        const newGroups = tournament.groups.map(g => {
            if (g.id === groupId) {
                return { ...g, teams: g.teams.filter(id => id !== teamId) };
            }
            return g;
        });
        await updateDoc(docRef, { groups: newGroups });
    };
    
    const handleScheduleMatch = async () => {
        if (!matchForm.groupId || !matchForm.teamAId || !matchForm.teamBId || !matchForm.startTime) {
            alert("Completa todos los campos para programar el partido.");
            return;
        }
        
        const group = tournament.groups.find(g => g.id === matchForm.groupId);
        const tA = allTeams.find(t => t.id === matchForm.teamAId);
        const tB = allTeams.find(t => t.id === matchForm.teamBId);
        const initialOdds = calculateOdds(tA, tB);

        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'matches'), {
            teamAId: matchForm.teamAId,
            teamBId: matchForm.teamBId,
            startTime: matchForm.startTime,
            status: 'scheduled',
            autoStart: true,
            scoreA: 0, scoreB: 0,
            currentMinute: 0, events: [], period: '1T', 
            addedTime: 0, halftimeCounter: 0, 
            createdAt: serverTimestamp(),
            tournamentId: tournament.id,
            groupId: matchForm.groupId,
            groupName: group ? group.name : null, 
            jornada: matchForm.jornada || null, 
            seriesId: null,
            matchType: 'group', 
            initialOdds: initialOdds
        });
        
        setMatchForm({ groupId: null, teamAId: '', teamBId: '', startTime: '', jornada: '' });
    };

    const handleSetupKnockout = async () => {
        const type = parseInt(knockoutSetup, 10);
        let rounds = Math.log2(type); 
        let matches = [];
        let matchIdCounter = 1;

        for (let r = 0; r < rounds; r++) {
            const matchesInRound = type / Math.pow(2, r + 1);
            
            for (let m = 0; m < matchesInRound; m++) {
                let name = "";
                if (matchesInRound === 8) name = `Octavos ${m+1}`;
                else if (matchesInRound === 4) name = `Cuartos ${m+1}`;
                else if (matchesInRound === 2) name = `Semifinal ${m+1}`;
                else if (matchesInRound === 1) name = `FINAL`;

                matches.push({
                    id: `ko-m-${matchIdCounter}`,
                    name: name,
                    round: r, 
                    teamA: null,
                    teamB: null,
                    matchId: null 
                });
                matchIdCounter++;
            }
        }

        if (thirdPlace) {
            matches.push({
                id: `ko-m-3rd`,
                name: '3er Puesto',
                round: 99, 
                teamA: null,
                teamB: null,
                matchId: null
            });
        }

        const newKnockout = {
            type: type,
            matches: matches
        };
        await updateDoc(docRef, { knockout: newKnockout });
    };
    
    const handleUpdateKnockoutMatch = async (koMatchId, teamSide, teamId) => {
        if (!tournament.knockout) return;
        
        const newMatches = tournament.knockout.matches.map(m => {
            if (m.id === koMatchId) {
                return { ...m, [teamSide]: teamId || null }; 
            }
            return m;
        });
        
        const newKnockout = { ...tournament.knockout, matches: newMatches };
        
        await updateDoc(docRef, { knockout: newKnockout });
    };

    const handleCreateKnockoutMatch = async (koMatch) => {
        if (!koMatch.teamA || !koMatch.teamB) {
            alert("Selecciona ambos equipos para programar el partido.");
            return;
        }

        const date = koMatchDates[koMatch.id];
        if (!date) {
            alert("Por favor selecciona una fecha y hora para el partido.");
            return;
        }

        const tA = allTeams.find(t => t.id === koMatch.teamA);
        const tB = allTeams.find(t => t.id === koMatch.teamB);
        const initialOdds = calculateOdds(tA, tB);

        const matchRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'matches'), {
            teamAId: koMatch.teamA,
            teamBId: koMatch.teamB,
            startTime: date, 
            status: 'scheduled',
            autoStart: true,
            scoreA: 0, scoreB: 0,
            currentMinute: 0, events: [], period: '1T',
            addedTime: 0, halftimeCounter: 0,
            createdAt: serverTimestamp(),
            tournamentId: tournament.id,
            groupId: null,
            groupName: null,
            stageName: koMatch.name, 
            jornada: null,
            seriesId: null,
            matchType: 'knockout', 
            initialOdds: initialOdds
        });

        const newMatches = tournament.knockout.matches.map(m => {
            if (m.id === koMatch.id) {
                return { ...m, matchId: matchRef.id };
            }
            return m;
        });
        
        await updateDoc(docRef, { knockout: { ...tournament.knockout, matches: newMatches } });
    };

    // --- LÓGICA DE REINICIO ---
    const confirmReset = async () => {
        // 1. Resetear torneo
        await updateDoc(docRef, {
            groups: [],
            knockout: null
        });

        // 2. Borrar partidos
        const matchesRef = collection(db, 'artifacts', appId, 'public', 'data', 'matches');
        const q = query(matchesRef, where("tournamentId", "==", tournament.id));
        const snapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        setIsResetting(false);
    };

    const tournamentMatches = allMatches.filter(m => m.tournamentId === tournament.id);
    const teamOptions = [
        { value: '', label: 'A definir...' },
        ...allTeams.map(t => ({ value: t.id, label: t.name }))
    ];

    return (
        <div className="animate-in fade-in duration-300">
            <ConfirmModal 
                isOpen={isResetting}
                onClose={() => setIsResetting(false)}
                onConfirm={confirmReset}
                title="¿Reiniciar Torneo?"
                message="¡Atención! Esto eliminará todos los grupos, fases eliminatorias y partidos asociados a la copa. Esta acción no se puede deshacer."
            />

            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                {!isSingleMode && (
                    <Button variant="secondary" onClick={onBack}>
                        <ArrowLeft size={16} /> Volver a Torneos
                    </Button>
                )}
                
                <ToggleSwitch 
                    isEnabled={isEditMode}
                    onToggle={() => setIsEditMode(!isEditMode)}
                    labelLeft="Visual"
                    labelRight="Edición"
                    IconLeft={Eye}
                    IconRight={Edit}
                />
                
                <h2 className="text-2xl font-bold text-[#091F40] hidden md:block">{tournament.name}</h2>
                
                {isEditMode && (
                    <div className="flex gap-2">
                        {/* Botón de Reinicio */}
                        <Button variant="danger" onClick={() => setIsResetting(true)} className="bg-red-600 hover:bg-red-700">
                            <RotateCcw size={16} /> Reiniciar Copa
                        </Button>
                        {!isSingleMode && (
                            <Button variant="danger" onClick={() => onDeleteTournament(tournament.id)}>
                                <Trash2 size={16} /> Borrar
                            </Button>
                        )}
                    </div>
                )}
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <button onClick={() => setView('groups')} className={`pb-2 px-4 text-sm font-bold ${view === 'groups' ? 'text-[#009B3A] border-b-2 border-[#009B3A]' : 'text-gray-500'}`}>
                    Fase de Grupos
                </button>
                <button onClick={() => setView('knockout')} className={`pb-2 px-4 text-sm font-bold ${view === 'knockout' ? 'text-[#009B3A] border-b-2 border-[#009B3A]' : 'text-gray-500'}`}>
                    Eliminatoria
                </button>
            </div>

            {/* --- VISTA DE GRUPOS --- */}
            {view === 'groups' && (
                <div className="space-y-8">
                    {/* Formulario Añadir Grupo */}
                    {isEditMode && (
                        <Card className="p-4 bg-slate-50">
                            <h3 className="font-bold text-[#091F40] mb-2">Añadir Nuevo Grupo</h3>
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-[#009B3A]">Nombre del Grupo</label>
                                    <SmallInput 
                                        placeholder="Ej: Grupo A" 
                                        value={groupForm.name}
                                        onChange={e => setGroupForm({...groupForm, name: e.target.value})}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-[#009B3A]">Cupos Clasificación</label>
                                    <SmallInput 
                                        type="number" 
                                        min="1" max="4" 
                                        value={groupForm.classifiedSlots}
                                        onChange={e => setGroupForm({...groupForm, classifiedSlots: e.target.value})}
                                    />
                                </div>
                                <Button onClick={handleAddGroup} className="w-full md:w-auto"><Plus size={16} />Añadir</Button>
                            </div>
                        </Card>
                    )}
                    
                    {/* Lista de Grupos */}
                    {tournament.groups.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                            <p className="text-gray-400">No hay grupos configurados. ¡Añade uno para empezar!</p>
                        </div>
                    )}
                    {tournament.groups.map(group => {
                        const standings = calculateStandings(group.id, group.teams, allTeams, tournamentMatches);
                        const groupMatches = tournamentMatches.filter(m => m.groupId === group.id).reverse();
                        const teamsInGroup = group.teams.map(id => allTeams.find(t => t.id === id)).filter(Boolean);
                        const availableTeams = allTeams.filter(t => !group.teams.includes(t.id));

                        return (
                            <Card key={group.id} className="p-6">
                                <h3 className="text-xl font-bold text-[#091F40] mb-4">{group.name}</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Izquierda: Tabla y Equipos */}
                                    <div>
                                        <h4 className="font-bold text-[#091F40] mb-3">Tabla de Posiciones</h4>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm divide-y divide-gray-200">
                                                <thead className="bg-[#091F40] text-white">
                                                    <tr>
                                                        <th className="px-2 py-2 text-left text-xs font-bold uppercase tracking-wider">#</th>
                                                        <th className="px-2 py-2 text-left text-xs font-bold uppercase tracking-wider">Equipo</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider">PJ</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider">G</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider">E</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider">P</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider">DG</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold uppercase tracking-wider">Pts</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-100">
                                                    {standings.map((t, index) => (
                                                        <tr key={t.id} className={index < group.settings.classifiedSlots ? 'bg-green-50' : ''}>
                                                            <td className="px-2 py-2 whitespace-nowrap text-center text-[#091F40]">
                                                                {index + 1}
                                                                {index < group.settings.classifiedSlots && <CheckSquare size={14} className="text-[#009B3A] inline-block ml-1" />}
                                                            </td>
                                                            <td className="px-2 py-2 whitespace-nowrap font-medium text-[#091F40] flex items-center gap-2">
                                                                <img src={t.logo || `https://ui-avatars.com/api/?name=${t.name}`} className="w-5 h-5 rounded-full object-cover" />
                                                                {t.name}
                                                                {isEditMode && (
                                                                    <Trash2 size={14} className="text-gray-400 hover:text-[#EF4135] cursor-pointer" onClick={() => handleRemoveTeamFromGroup(group.id, t.id)} />
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-2 whitespace-nowrap text-center">{t.P}</td>
                                                            <td className="px-2 py-2 whitespace-nowrap text-center">{t.W}</td>
                                                            <td className="px-2 py-2 whitespace-nowrap text-center">{t.D}</td>
                                                            <td className="px-2 py-2 whitespace-nowrap text-center">{t.L}</td>
                                                            <td className="px-2 py-2 whitespace-nowrap text-center">{t.GD > 0 ? `+${t.GD}` : t.GD}</td>
                                                            <td className="px-2 py-2 whitespace-nowrap text-center font-bold">{t.Pts}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {isEditMode && (
                                            <div className="flex gap-2 mt-4">
                                                <SmallSelect
                                                    options={[{ value: '', label: 'Añadir equipo al grupo...' }, ...availableTeams.map(t => ({ value: t.id, label: t.name }))]}
                                                    value={teamToAdd.groupId === group.id ? teamToAdd.teamId : ''}
                                                    onChange={e => setTeamToAdd({ groupId: group.id, teamId: e.target.value })}
                                                />
                                                <Button variant="secondary" onClick={() => handleAddTeamToGroup(group.id)}><UsersRound size={16} /></Button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Derecha: Partidos */}
                                    <div className={isEditMode ? "border-l border-slate-100 pl-8" : ""}>
                                        {isEditMode && (
                                            <>
                                                <h4 className="font-bold text-[#091F40] mb-3">Programar Partido</h4>
                                                <div className="space-y-2 p-3 bg-slate-50 rounded-lg">
                                                    <SmallSelect options={[{ value: '', label: 'Local...' }, ...teamsInGroup.map(t => ({ value: t.id, label: t.name }))]} value={matchForm.groupId === group.id ? matchForm.teamAId : ''} onChange={e => setMatchForm({...matchForm, groupId: group.id, teamAId: e.target.value, teamBId: e.target.value === matchForm.teamBId ? '' : matchForm.teamBId})} />
                                                    <SmallSelect options={[{ value: '', label: 'Visitante...' }, ...teamsInGroup.filter(t => t.id !== matchForm.teamAId).map(t => ({ value: t.id, label: t.name }))]} value={matchForm.groupId === group.id ? matchForm.teamBId : ''} onChange={e => setMatchForm({...matchForm, groupId: group.id, teamBId: e.target.value})} />
                                                    <SmallInput type="datetime-local" value={matchForm.groupId === group.id ? matchForm.startTime : ''} onChange={e => setMatchForm({...matchForm, groupId: group.id, startTime: e.target.value})} />
                                                    <SmallInput type="number" min="1" placeholder="Jornada #" value={matchForm.groupId === group.id ? matchForm.jornada : ''} onChange={e => setMatchForm({...matchForm, groupId: group.id, jornada: e.target.value})} />
                                                    <Button onClick={handleScheduleMatch} className="w-full" disabled={matchForm.groupId !== group.id}><Calendar size={16}/> Programar</Button>
                                                </div>
                                            </>
                                        )}
                                        
                                        <h4 className="font-bold text-[#091F40] mt-6 mb-3">Partidos del Grupo</h4>
                                        <div className={`space-y-2 ${isEditMode ? 'max-h-48 overflow-y-auto' : ''}`}>
                                            {groupMatches.length === 0 && <p className="text-xs text-gray-500">No hay partidos programados para este grupo.</p>}
                                            {groupMatches.map(m => {
                                                const tA = allTeams.find(t => t.id === m.teamAId);
                                                const tB = allTeams.find(t => t.id === m.teamBId);
                                                return (
                                                    <div key={m.id} className="text-sm p-2 bg-white border border-gray-100 rounded flex flex-col gap-1">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                {m.jornada && <span className="text-xs font-bold text-gray-400">J{m.jornada}</span>}
                                                                <span className="font-bold text-[#091F40]">{tA?.shortName || '?'}</span> {m.scoreA} - {m.scoreB} <span className="font-bold text-[#091F40]">{tB?.shortName || '?'}</span>
                                                            </div>
                                                            <Badge status={m.status} period={m.period} />
                                                        </div>
                                                        <div className="text-[10px] text-gray-400 text-right">{formatDate(m.startTime)}</div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            )}
            
            {/* --- VISTA DE ELIMINATORIA --- */}
            {view === 'knockout' && (
                <div className="space-y-6">
                    {/* Formulario Configurar */}
                    {isEditMode && (
                        <Card className="p-6">
                            <h3 className="font-bold text-[#091F40] mb-3">Configurar Eliminatoria</h3>
                            <div className="flex flex-col gap-2">
                                <div className="flex gap-4 items-end">
                                    <div className="flex-1">
                                        <label className="text-[10px] font-bold text-[#009B3A]">Equipos en Fase Final</label>
                                        <SmallSelect 
                                            options={[
                                                {value: 4, label: '4 Equipos (Semifinal)'},
                                                {value: 8, label: '8 Equipos (Cuartos de Final)'},
                                                {value: 16, label: '16 Equipos (Octavos de Final)'},
                                            ]}
                                            value={knockoutSetup}
                                            onChange={e => setKnockoutSetup(e.target.value)}
                                        />
                                    </div>
                                    <Button onClick={handleSetupKnockout}><Trello size={16} /> Generar Cuadro</Button>
                                </div>
                                <label className="flex items-center gap-2 text-sm text-[#009B3A] font-bold mt-2">
                                    <input 
                                        type="checkbox" 
                                        checked={thirdPlace} 
                                        onChange={e => setThirdPlace(e.target.checked)}
                                        className="accent-[#009B3A] w-4 h-4"
                                    /> 
                                    Incluir partido por 3er Puesto
                                </label>
                            </div>
                        </Card>
                    )}

                    {tournament.knockout ? (
                        <Card className="p-6">
                             <h3 className="text-xl font-bold text-[#091F40] mb-4">Cuadro de Eliminatoria</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {tournament.knockout.matches.map(koMatch => {
                                    const linkedMatch = koMatch.matchId ? allMatches.find(m => m.id === koMatch.matchId) : null;
                                    const teamAObj = allTeams.find(t => t.id === koMatch.teamA);
                                    const teamBObj = allTeams.find(t => t.id === koMatch.teamB);

                                    return (
                                        <div key={koMatch.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="font-bold text-sm text-[#091F40]">{koMatch.name}</div>
                                                {linkedMatch && (
                                                    <div className="flex items-center gap-2">
                                                        <Badge status={linkedMatch.status} period={linkedMatch.period} />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {isEditMode && !linkedMatch ? (
                                                <div className="space-y-2">
                                                    <SmallSelect 
                                                        options={teamOptions} 
                                                        value={koMatch.teamA || ''}
                                                        onChange={(e) => handleUpdateKnockoutMatch(koMatch.id, 'teamA', e.target.value)}
                                                    />
                                                    <SmallSelect 
                                                        options={teamOptions}
                                                        value={koMatch.teamB || ''}
                                                        onChange={(e) => handleUpdateKnockoutMatch(koMatch.id, 'teamB', e.target.value)}
                                                    />
                                                    
                                                    {koMatch.teamA && koMatch.teamB && (
                                                        <>
                                                            <div className="pt-2">
                                                                <label className="text-[10px] font-bold text-gray-500 uppercase">Fecha del Partido</label>
                                                                <SmallInput 
                                                                    type="datetime-local" 
                                                                    value={koMatchDates[koMatch.id] || ''}
                                                                    onChange={(e) => setKoMatchDates({...koMatchDates, [koMatch.id]: e.target.value})}
                                                                />
                                                            </div>
                                                            <Button onClick={() => handleCreateKnockoutMatch(koMatch)} className="w-full mt-2" variant="secondary">
                                                                <Play size={14} /> Programar Partido
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="bg-white rounded border border-gray-200 p-2">
                                                    {linkedMatch && (
                                                        <div className="text-[10px] text-center text-gray-500 mb-1 border-b border-gray-50 pb-1">
                                                            {formatDate(linkedMatch.startTime)}
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center py-1">
                                                        <span className={!koMatch.teamA ? 'text-gray-400' : 'font-bold text-[#091F40]'}>
                                                            {teamAObj?.name || 'A definir'}
                                                        </span>
                                                        {linkedMatch && <span className="font-bold text-lg">{linkedMatch.scoreA}</span>}
                                                    </div>
                                                    <div className="flex justify-between items-center py-1 border-t border-gray-50">
                                                        <span className={!koMatch.teamB ? 'text-gray-400' : 'font-bold text-[#091F40]'}>
                                                            {teamBObj?.name || 'A definir'}
                                                        </span>
                                                        {linkedMatch && <span className="font-bold text-lg">{linkedMatch.scoreB}</span>}
                                                    </div>
                                                    {linkedMatch?.penaltyShootout?.winner && (
                                                        <div className="text-xs text-[#091F40] font-bold mt-1 text-center">
                                                            Gana {linkedMatch.penaltyShootout.winner === 'A' ? teamAObj?.shortName : teamBObj?.shortName} en Penales
                                                        </div>
                                                    )}
                                                    {!linkedMatch && isEditMode === false && (
                                                         <div className="text-xs text-center text-gray-400 mt-2 italic">Por programar...</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                             </div>
                        </Card>
                    ) : (
                        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                            <p className="text-gray-400">Aún no se ha generado el cuadro de eliminatorias.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
  };


  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-[#091F40] font-sans p-4">
      <div className="animate-spin text-[#009B3A] mb-4"><Activity size={32} /></div>
      <div className="font-bold text-lg animate-pulse">Cargando Sistema de Táctica...</div>
      <div className="text-sm text-gray-500 mt-2">Autenticando con Firebase</div>
    </div>
  );
  
  const navItems = [
    { id: 'dashboard', icon: Activity, label: 'Inicio' },
    { id: 'tournaments', icon: Shield, label: 'Torneos' }, 
    { id: 'teams', icon: Users, label: 'Clubes' },
    { id: 'matches', icon: Calendar, label: 'Partidos' }
  ];

  return (
    <div className="min-h-screen bg-[#F0FFF4] text-[#091F40] font-sans pb-20 md:pb-0 selection:bg-[#009B3A] selection:text-white">
      <ConfirmModal 
        isOpen={!!deleteTeamId} 
        title="¿Eliminar Club?" 
        message="Esta acción no se puede deshacer y borrará todos los datos asociados al equipo."
        onClose={() => setDeleteTeamId(null)}
        onConfirm={async () => {
            if(user) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'teams', deleteTeamId));
        }}
      />
      <ConfirmModal 
        isOpen={!!deleteMatchId} 
        title="¿Borrar Partido?" 
        message="El partido será eliminado del historial permanentemente. Si es parte de una serie de Ida/Vuelta, el otro partido NO será borrado."
        onClose={() => setDeleteMatchId(null)}
        onConfirm={async () => {
            if(user) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', deleteMatchId));
        }}
      />
      <ConfirmModal 
        isOpen={!!deleteTournamentId} 
        title="¿Eliminar Torneo?" 
        message="Esta acción borrará el torneo, sus grupos y configuración. LOS PARTIDOS DEL TORNEO NO SERÁN BORRADOS de la lista general."
        onClose={() => setDeleteTournamentId(null)}
        onConfirm={async () => {
            if(user) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'tournaments', deleteTournamentId));
        }}
      />
      <EditDateModal 
        isOpen={!!editDateMatchId} 
        currentDate={editDateCurrent}
        onClose={() => setEditDateMatchId(null)}
        onConfirm={handleUpdateMatchDate}
      />

      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-gradient-to-b from-[#009e5e] to-[#061a2b] flex-col p-6 z-50 shadow-2xl border-r border-[#009B3A]">
        <div className="flex flex-col items-center mb-10 text-white border-b border-[#009B3A]/30 pb-6">
          <img 
              src="https://i.postimg.cc/T1xy0cy4/IMG-4967.png" 
              className="w-24 h-24 object-contain"
              alt="Logo"
          />
          <h1 className="text-center font-black italic text-lg leading-tight tracking-tight mt-2">COPA DE LOS <br/><span className="text-[#EF4135] bg-white px-1 rounded-sm inline-block mt-1 transform -skew-x-12 shadow-sm">REYES 2026</span></h1>
        </div>
        <nav className="space-y-2 flex-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setSelectedMatchId(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-bold uppercase tracking-wide ${view === item.id ? 'bg-white text-[#091F40] shadow-md' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>
              <item.icon size={18} className={view === item.id ? "text-[#F58220]" : ""} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="text-[10px] text-center text-white/50 uppercase font-bold tracking-wider">v5.4 - Brazil Edition</div>
      </div>
      
      <div className="md:hidden bg-gradient-to-r from-[#009B3A] to-[#091F40] p-4 flex justify-between items-center sticky top-0 z-40 shadow-md">
         <div className="flex items-center gap-2 text-white font-black italic"><img 
              src="https://i.postimg.cc/T1xy0cy4/IMG-4967.png" 
              className="w-10 h-10 object-contain"
              alt="Logo"
            /> <span className="text-xl">COPA REYES</span></div>
         <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white">{mobileMenuOpen ? <X /> : <Menu />}</button>
      </div>
      
      {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-[#091F40]/95 z-50 flex flex-col items-center justify-center gap-8 backdrop-blur-md">
              <button onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 text-white"><X size={32} /></button>
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setView(item.id); setSelectedMatchId(null); setMobileMenuOpen(false); }} className="text-2xl font-bold text-white uppercase tracking-widest hover:text-[#F58220] transition-colors">{item.label}</button>
              ))}
          </div>
      )}
      
      <main className="md:pl-64 p-4 md:p-8 max-w-6xl mx-auto">
         {selectedMatchId ? <MatchDetail match={matches.find(m => m.id === selectedMatchId)} onBack={() => setSelectedMatchId(null)} /> : (
            <>
              {view === 'dashboard' && <DashboardView />}
              {view === 'teams' && <TeamsView />}
              {view === 'matches' && <MatchesView />}
              {view === 'tournaments' && (
                <TournamentsView 
                  tournaments={tournaments}
                  allTeams={teams}
                  allMatches={matches}
                  user={user}
                  onDeleteClick={(id) => setDeleteTournamentId(id)}
                />
              )}
            </>
         )}
      </main>
    </div>
  );
}
