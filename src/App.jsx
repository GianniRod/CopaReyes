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
  serverTimestamp,
  writeBatch,
  arrayUnion, 
  arrayRemove 
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
  Edit, // --- NUEVO ---
  Eye // --- NUEVO ---
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

// --- NUEVO: Utilidad para calcular tablas de posiciones ---
const calculateStandings = (groupId, teamIds, allTeams, allMatches) => {
    // 1. Inicializar la tabla
    const standings = teamIds.map(id => {
        const teamData = allTeams.find(t => t.id === id) || { id, name: 'Equipo Desconocido' };
        return { 
            ...teamData, 
            P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 
        };
    });

    // 2. Filtrar solo partidos de este grupo que hayan terminado
    const groupMatches = allMatches.filter(m => m.groupId === groupId && m.status === 'finished');
    
    // 3. Iterar y calcular
    for (const match of groupMatches) {
        const teamA = standings.find(t => t.id === match.teamAId);
        const teamB = standings.find(t => t.id === match.teamBId);
        
        // Omitir si algún equipo ya no está en el grupo
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
    
    // 4. Calcular GD
    standings.forEach(t => t.GD = t.GF - t.GA);
    
    // 5. Ordenar
    standings.sort((a, b) => {
        if (a.Pts !== b.Pts) return b.Pts - a.Pts; // Puntos
        if (a.GD !== b.GD) return b.GD - a.GD; // Diferencia de Gol
        if (a.GF !== b.GF) return b.GF - a.GF; // Goles a Favor
        return a.name.localeCompare(b.name); // Alfabético
    });
    
    return standings;
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

// --- NUEVO: Input más pequeño ---
const SmallInput = ({ ...props }) => (
  <input 
    className="bg-white border border-green-200 text-green-900 rounded-lg p-2 focus:ring-2 focus:ring-green-500 outline-none transition-all w-full"
    {...props}
  />
);
const SmallSelect = ({ options, ...props }) => (
  <select 
    className="bg-white border border-green-200 text-green-900 rounded-lg p-2 focus:ring-2 focus:ring-green-500 outline-none w-full"
    {...props}
  >
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
  </select>
);
// --- FIN NUEVO ---

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
    penalties: "bg-blue-600 text-white shadow-md shadow-blue-200 animate-pulse",
    finished: "bg-green-700 text-white",
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

// --- NUEVO: Componente Toggle Switch ---
const ToggleSwitch = ({ isEnabled, onToggle, labelLeft, labelRight, IconLeft, IconRight }) => (
  <div className="flex items-center gap-2">
    <span className={`font-bold text-xs uppercase ${!isEnabled ? 'text-red-600' : 'text-gray-400'}`}>
        {IconLeft && <IconLeft size={16} className="inline-block mr-1" />}
        {labelLeft}
    </span>
    <button
      onClick={onToggle}
      className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${isEnabled ? 'bg-green-600' : 'bg-gray-300'}`}
    >
      <span
        className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
    <span className={`font-bold text-xs uppercase ${isEnabled ? 'text-green-700' : 'text-gray-400'}`}>
        {IconRight && <IconRight size={16} className="inline-block mr-1" />}
        {labelRight}
    </span>
  </div>
);


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
  const [tournaments, setTournaments] = useState([]); 
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [timeScale, setTimeScale] = useState(60000); // Default x1
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [deleteTeamId, setDeleteTeamId] = useState(null);
  const [deleteMatchId, setDeleteMatchId] = useState(null);
  const [deleteTournamentId, setDeleteTournamentId] = useState(null); 

  // Auth
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
    
    const userTeamsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'teams');
    const userMatchesPath = collection(db, 'artifacts', appId, 'users', user.uid, 'matches');
    const userTournamentsPath = collection(db, 'artifacts', appId, 'users', user.uid, 'tournaments'); 

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

    const unsubTournaments = onSnapshot(
        query(userTournamentsPath, orderBy('createdAt', 'desc')),
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
    if (match.groupId) startText = `¡Comienza el partido del ${match.groupName || 'Grupo'}!`; // --- MODIFICADO ---

    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), {
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
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), updates);
      return;
    }

    const currentMin = match.currentMinute;
    const nextMin = currentMin + 1;
    const isFirstHalf = match.period === '1T';
    const regularTimeEnd = isFirstHalf ? 45 : 90;
    const maxTime = regularTimeEnd + (match.addedTime || 0);

    // --- INICIO: LÓGICA DE FIN DE PARTIDO (MODIFICADA) ---
    if (currentMin >= maxTime) {
      if (isFirstHalf) {
        updates = { status: 'halftime', period: 'HT', halftimeCounter: 0, events: [...newEvents, { type: 'whistle', minute: currentMin, text: `Fin del 1T (+${match.addedTime}')` }] };
      } else {
        // Es el final del 2T
        newEvents.push({ type: 'whistle', minute: currentMin, text: `¡FINAL DEL PARTIDO! (+${match.addedTime}')` });
        updates.events = newEvents;
        
        // --- MODIFICADO: Añadir lógica para partidos de torneo ---
        // Los partidos de grupo (matchType 'group') NUNCA van a penales
        if (match.matchType === 'group') {
            updates.status = 'finished';
        }
        else if (match.matchType === 'single') {
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
            // Caso por defecto (partido de liga/amistoso sin tipo)
            updates.status = 'finished';
        }
      }
      
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), updates);
      return;
    }
    // --- FIN: LÓGICA DE FIN DE PARTIDO ---

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

  const handlePenaltyKick = async (match) => {
    if (!user || !match.penaltyShootout || match.penaltyShootout.isKicking || match.penaltyShootout.winner) return;
    const teamA = teams.find(t => t.id === match.teamAId);
    const teamB = teams.find(t => t.id === match.teamBId);
    if (!teamA || !teamB) return;
    const currentShootout = JSON.parse(JSON.stringify(match.penaltyShootout));
    const newEvents = [...match.events];
    currentShootout.isKicking = true;
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), { penaltyShootout: currentShootout });
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
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), {
      status: newStatus,
      penaltyShootout: currentShootout,
      events: newEvents
    });
  };


  // --- COMPONENTES DE VISTA ---

  const PenaltyShootoutUI = ({ match, onKick }) => {
    const teamA = teams.find(t => t.id === match.teamAId);
    const teamB = teams.find(t => t.id === match.teamBId);
    const shootout = match.penaltyShootout;
    if (!teamA || !teamB || !shootout) return null;
    const renderIcon = (result, index) => {
      if (result === 'goal') {
        return <div key={index} className="w-7 h-7 rounded-full bg-green-500 border-2 border-green-600 flex items-center justify-center shadow-inner">
          <Check size={18} className="text-white" />
        </div>;
      }
      if (result === 'miss') {
        return <div key={index} className="w-7 h-7 rounded-full bg-red-500 border-2 border-red-600 flex items-center justify-center shadow-inner">
          <X size={18} className="text-white" />
        </div>;
      }
      return <div key={index} className="w-7 h-7 rounded-full bg-gray-200 border-2 border-gray-300 shadow-inner"></div>;
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
      <Card className="lg:col-span-12 bg-blue-50 border-blue-200 animate-in fade-in duration-300">
        <div className="p-6">
          <h3 className="text-blue-800 uppercase text-sm font-bold mb-6 flex items-center gap-2 border-b border-blue-100 pb-2">
            <Target size={14} className="text-blue-600" /> Tanda de Penales
          </h3>
          <div className="flex justify-center items-start gap-6 mb-6">
            <div className="flex flex-col items-center gap-3 flex-1">
              <span className="text-lg font-bold text-gray-700 text-center">{teamA.name}</span>
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
              <div className="text-4xl font-bold text-blue-900">{shootout.scoreA}</div>
            </div>
            <div className="text-2xl text-gray-400 font-bold pt-10">vs</div>
            <div className="flex flex-col items-center gap-3 flex-1">
              <span className="text-lg font-bold text-gray-700 text-center">{teamB.name}</span>
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
              <div className="text-4xl font-bold text-blue-900">{shootout.scoreB}</div>
            </div>
          </div>
          <div className="text-center">
            {isFinished ? (
              <p className="text-xl font-bold text-green-600">¡GANADOR: {(shootout.winner === 'A' ? teamA.name : teamB.name).toUpperCase()}!</p>
            ) : (
              <Button onClick={onKick} disabled={shootout.isKicking} className="bg-blue-600 hover:bg-blue-700 shadow-blue-200 text-lg px-8 py-3">
                {shootout.isKicking ? 'Pateando...' : `Patear (${kickerName})`}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const MatchDetail = ({ match, onBack }) => {
      const teamA = teams.find(t => t.id === match.teamAId);
      const teamB = teams.find(t => t.id === match.teamBId);
      const stats = match.stats || { possession: 50, shotsA: 0, shotsB: 0, onTargetA: 0, onTargetB: 0, foulsA: 0, foulsB: 0, yellowA: 0, yellowB: 0, redA: 0, redB: 0, cornersA: 0, cornersB: 0 };
      const [seconds, setSeconds] = useState(0);
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
      
      // --- NUEVO: Lógica para etiqueta de Torneo ---
      let tournamentLabel = null;
      if (match.tournamentId) {
          if (match.groupName) {
              tournamentLabel = `${match.groupName}${match.jornada ? `, J${match.jornada}` : ''}`;
          } else {
              tournamentLabel = "Fase Eliminatoria"; // O buscar el nombre de la ronda si estuviera guardado
          }
      }
      
      return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
              <div className="flex justify-between items-center mb-4 bg-white p-3 rounded-lg border border-green-100 shadow-sm">
                <button onClick={onBack} className="text-green-700 hover:text-green-900 flex items-center gap-2 text-sm font-bold uppercase">← Volver</button>
                {match.status !== 'penalties' && !(match.status === 'finished' && match.penaltyShootout) && (
                  <div className="flex gap-1">
                    {[60000, 2000, 1000, 50].map(speed => (
                        <button key={speed} onClick={() => setTimeScale(speed)} className={`w-8 h-8 flex items-center justify-center rounded text-xs font-bold transition-colors ${timeScale === speed ? 'bg-red-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                            {speed === 60000 ? 'x1' : speed === 2000 ? 'x30' : speed === 1000 ? 'x60' : '⚡'}
                        </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gradient-to-r from-green-800 to-green-700 rounded-t-2xl border-b-4 border-red-600 p-6 md:p-8 text-center relative overflow-hidden shadow-xl">
                  {match.matchType === 'leg1' && <div className="absolute top-3 left-3 z-20 bg-white/20 text-white text-xs font-bold uppercase px-2 py-1 rounded">Partido de Ida</div>}
                  {match.matchType === 'leg2' && <div className="absolute top-3 left-3 z-20 bg-white/20 text-white text-xs font-bold uppercase px-2 py-1 rounded">Partido de Vuelta</div>}
                  {/* --- MODIFICADO: Mostrar etiqueta de torneo --- */}
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
                          <div className="bg-white border border-green-100 rounded-xl p-6 shadow-sm">
                              <h3 className="text-green-800 uppercase text-xs font-bold mb-6 flex items-center gap-2 border-b border-green-100 pb-2">
                                  <Activity size={14} className="text-red-600" /> Datos del Partido
                              </h3>
                              <div className="space-y-5">
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
                          {match.status !== 'finished' && (
                            <div className="bg-white border border-green-100 rounded-xl p-4 shadow-sm flex flex-col gap-2">
                                {match.status === 'scheduled' && <Button onClick={() => startMatch(match)} className="w-full"><Play size={14}/> Iniciar Partido</Button>}
                                {(match.status === 'live' || match.status === 'halftime') && <Button variant="secondary" onClick={() => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', match.id), { status: 'finished' })} className="w-full text-red-600 border-red-100">Terminar Partido</Button>}
                                <div className="flex gap-2 mt-2">
                                    <button onClick={() => updateMatchScoreManual(match.id, 'A', 1)} className="flex-1 bg-green-50 hover:bg-green-100 text-green-800 text-xs font-bold py-2 rounded border border-green-200">+ GOL LOC</button>
                                    <button onClick={() => updateMatchScoreManual(match.id, 'B', 1)} className="flex-1 bg-green-50 hover:bg-green-100 text-green-800 text-xs font-bold py-2 rounded border border-green-200">+ GOL VIS</button>
                                </div>
                            </div>
                          )}
                      </div>
                      <div className="lg:col-span-8 bg-white border border-green-100 rounded-xl overflow-hidden flex flex-col h-[600px] shadow-sm">
                          <div className="bg-green-50 p-3 border-b border-green-100"><h3 className="text-green-800 font-bold text-xs uppercase flex items-center gap-2"><Timer size={14} /> Minuto a Minuto</h3></div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
                              {[...match.events].reverse().map((ev, idx) => (
                                  <div key={idx} className={`flex items-start gap-3 p-3 rounded border shadow-sm ${ev.type === 'goal' ? 'bg-yellow-50 border-yellow-200' : (ev.type === 'whistle' ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100')}`}>
                                      <div className="text-green-700 font-mono font-bold text-sm min-w-[32px] text-right">{ev.minute}'</div>
                                      <div className="flex-1"><p className={`text-sm font-medium ${ev.type === 'goal' ? 'text-green-900 font-bold' : (ev.type === 'whistle' ? 'text-blue-800 font-bold' : 'text-gray-600')}`}>{ev.text}</p></div>
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

  const MatchCard = ({ match, onClick, onDelete }) => {
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
          else if (match.matchType === 'single' || match.matchType === 'group') { // --- MODIFICADO ---
              if (match.scoreA > match.scoreB) winner = 'A';
              if (match.scoreB > match.scoreA) winner = 'B';
          }
          if (winner === 'B') scoreOpacityA = 'opacity-50';
          if (winner === 'A') scoreOpacityB = 'opacity-50';
      }
      let timeLabel = "";
      if (match.status === 'scheduled') {
          timeLabel = new Date(match.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
      } else if (match.status === 'penalties') { timeLabel = "PEN"; }
      else if (match.status === 'finished' && match.penaltyShootout) { timeLabel = "PEN(F)"; }
      else if (match.status !== 'finished') {
          if (match.status === 'halftime') { timeLabel = "MT"; }
          else if ((match.period === '1T' && match.currentMinute > 45) || (match.period === '2T' && match.currentMinute > 90)) {
              const regular = match.period === '1T' ? 45 : 90;
              const added = match.currentMinute - regular;
              timeLabel = `${String(regular).padStart(2, '0')}+${String(added).padStart(2, '0')}`;
          } else { timeLabel = `${String(match.currentMinute).padStart(2, '0')}:00`; }
      }
      let globalLabel = null;
      // --- MODIFICADO: Lógica de Global (Visual) ---
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
      
      // --- NUEVO: Etiqueta de Torneo ---
      let tournamentLabel = null;
      if (match.tournamentId) {
          if (match.groupName) {
              tournamentLabel = `${match.groupName}${match.jornada ? `, J${match.jornada}` : ''}`;
          } else if (match.matchType !== 'group') {
              tournamentLabel = "Eliminatoria"; // Etiqueta genérica para KO
          }
      }

      return (
          <div onClick={onClick} className="p-4 hover:bg-green-50 transition-all cursor-pointer group relative overflow-hidden rounded-xl">
              {(match.status === 'live' || match.status === 'penalties') && <div className={`absolute left-0 top-0 bottom-0 w-1 ${match.status === 'live' ? 'bg-red-500' : 'bg-blue-500'}`}></div>}
              <button onClick={(e) => { e.stopPropagation(); onDelete(match.id); }}
                  className="absolute top-2 right-2 z-20 text-gray-300 hover:text-red-600 p-1.5 bg-white/80 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 size={14} />
              </button>
              <div className="flex justify-between items-center mb-1 pl-2">
                  <Badge status={match.status} period={match.period} />
                  <span className="text-xs text-gray-500 font-mono">{timeLabel}</span>
              </div>
              {/* --- MODIFICADO: Color de Texto y Lógica de Torneo --- */}
              <div className="flex justify-between items-center mb-4 pl-2 text-xs text-green-800 font-bold h-4">
                 <span className="truncate">
                    {match.matchType === 'leg1' && 'IDA'}
                    {match.matchType === 'leg2' && 'VUELTA'}
                    {/* --- NUEVO: Mostrar info de torneo --- */}
                    {tournamentLabel}
                 </span>
                 <span className="whitespace-nowrap flex-shrink-0">
                    {globalLabel}
                 </span>
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
    const liveMatches = matches.filter(m => m.status === 'live' || m.status === 'halftime' || m.status === 'penalties');
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="relative rounded-2xl overflow-hidden bg-green-800 p-8 shadow-xl text-white mb-8 border-b-4 border-red-600">
            <div className="relative z-10">
                <div className="flex items-center gap-2 text-yellow-400 font-bold uppercase tracking-widest text-sm mb-2"><img 
  src="https://i.postimg.cc/T1xy0cy4/IMG-4967.png" 
  className="w-14 h-14 object-contain"
  alt="Logo"
/> Edición Táctica</div>
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
               <Input label="Abreviatura (3 letras)" value={formData.shortName} onChange={e => setFormData({...formData, shortName: e.target.value.toUpperCase().substring(0, 3)})} maxLength={3} />
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
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTeamId(t.id); }} className="text-gray-400 hover:text-red-500 p-2"> <Trash2 size={16}/> </button>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-green-500" style={{width: `${t.probability*100}%`}}></div></div>
            </div>
        ))}</div>
      </div>
    );
  };

  const MatchCardWrapper = ({ match, allMatches, onClick, onDelete }) => {
    // --- MODIFICADO: Simplificado ---
    // Si es 'leg1', se renderizará una card doble.
    // Si es 'leg2', se omitirá (ya se renderizó con 'leg1').
    // Si es 'single' o 'group', se renderizará una card simple.
    if (match.matchType === 'leg2') {
        return null; // Ya se maneja junto con leg1
    }

    if (match.matchType === 'leg1') {
      const leg2 = allMatches.find(m => m.seriesId === match.seriesId && m.matchType === 'leg2');
      return (
        <div className="bg-white border border-green-100 rounded-xl shadow-sm overflow-hidden divide-y divide-green-100">
          <MatchCard match={match} onClick={() => onClick(match.id)} onDelete={onDelete} />
          {leg2 && ( <MatchCard match={leg2} onClick={() => onClick(leg2.id)} onDelete={onDelete} /> )}
        </div>
      );
    }
    
    // Default: 'single', 'group', o cualquier otro tipo
    return (
      <div className="bg-white border border-green-100 rounded-xl shadow-sm overflow-hidden">
        <MatchCard match={match} onClick={() => onClick(match.id)} onDelete={onDelete} />
      </div>
    );
  };

  const MatchesView = () => {
    const [isScheduling, setIsScheduling] = useState(false);
    const [formData, setFormData] = useState({ teamAId: '', teamBId: '', startTime: '', startTimeLeg2: '', matchType: 'single', autoStart: true });
    const handleSchedule = async (e) => { 
        e.preventDefault(); 
        if (!user) return;
        const baseData = { status: 'scheduled', scoreA: 0, scoreB: 0, currentMinute: 0, events: [], period: '1T', addedTime: 0, halftimeCounter: 0, createdAt: serverTimestamp(), autoStart: formData.autoStart, tournamentId: null, groupId: null, groupName: null, jornada: null, seriesId: null, matchType: 'single' };
        if (formData.matchType === 'single') {
            if (!formData.teamAId || !formData.teamBId || !formData.startTime) return;
            await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'matches'), { ...baseData, teamAId: formData.teamAId, teamBId: formData.teamBId, startTime: formData.startTime });
        } else {
            if (!formData.teamAId || !formData.teamBId || !formData.startTime || !formData.startTimeLeg2) return;
            const seriesId = `series-${crypto.randomUUID()}`;
            const batch = writeBatch(db);
            const matchesCollection = collection(db, 'artifacts', appId, 'users', user.uid, 'matches');
            const leg1Ref = doc(matchesCollection);
            batch.set(leg1Ref, { ...baseData, teamAId: formData.teamAId, teamBId: formData.teamBId, startTime: formData.startTime, matchType: 'leg1', seriesId: seriesId });
            const leg2Ref = doc(matchesCollection);
            batch.set(leg2Ref, { ...baseData, teamAId: formData.teamBId, teamBId: formData.teamAId, startTime: formData.startTimeLeg2, matchType: 'leg2', seriesId: seriesId });
            await batch.commit();
        }
        setIsScheduling(false); 
        setFormData({ teamAId: '', teamBId: '', startTime: '', startTimeLeg2: '', matchType: 'single', autoStart: true });
    };
    
    // --- MODIFICADO: Mostrar partidos de torneo (filtrar solo leg2) ---
    const matchesToDisplay = matches.filter(m => m.matchType !== 'leg2');

    return (
      <div>
         <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold text-green-900">Calendario (Series)</h2><Button onClick={() => setIsScheduling(!isScheduling)}>{isScheduling ? 'Cancelar' : <><Calendar size={16} /> Programar Serie</>}</Button></div>
         {isScheduling && <Card className="p-6 mb-6 shadow-lg animate-in slide-in-from-top-2"><form onSubmit={handleSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Tipo de Partido" options={[{value:'single', label:'Partido Único'}, {value:'twoLegged', label:'Ida y Vuelta'}]} value={formData.matchType} onChange={e=>setFormData({...formData, matchType: e.target.value})} className="md:col-span-2" />
            <Select label="Equipo Local (Ida)" options={[{value:'', label:'Local...'}, ...teams.map(t => ({value:t.id, label:t.name}))]} value={formData.teamAId} onChange={e=>setFormData({...formData, teamAId: e.target.value})} />
            <Select label="Equipo Visitante (Ida)" options={[{value:'', label:'Visita...'}, ...teams.filter(t=>t.id!==formData.teamAId).map(t => ({value:t.id, label:t.name}))]} value={formData.teamBId} onChange={e=>setFormData({...formData, teamBId: e.target.value})} />
            <Input label={formData.matchType === 'single' ? 'Fecha y Hora' : 'Fecha Partido Ida'} type="datetime-local" value={formData.startTime} onChange={e=>setFormData({...formData, startTime: e.target.value})} className={formData.matchType === 'single' ? 'md:col-span-2' : ''} />
            {formData.matchType === 'twoLegged' && ( <Input label="Fecha Partido Vuelta" type="datetime-local" value={formData.startTimeLeg2} onChange={e=>setFormData({...formData, startTimeLeg2: e.target.value})} /> )}
            <label className="flex items-center gap-2 text-sm text-green-700 font-bold md:col-span-2"><input type="checkbox" checked={formData.autoStart} onChange={e=>setFormData({...formData, autoStart: e.target.checked})} className="accent-green-600 w-4 h-4" /> Iniciar partidos automáticamente</label>
            <Button type="submit" className="md:col-span-2">Confirmar</Button>
         </form></Card>}
         <div className="grid gap-3">{matchesToDisplay.map(m => (
             <MatchCardWrapper key={m.id} match={m} allMatches={matches} onClick={setSelectedMatchId} onDelete={(id) => setDeleteMatchId(id)} />
         ))}</div>
      </div>
    );
  };
  
  // --- NUEVO: Vista de Torneos ---
  const TournamentsView = ({ tournaments, allTeams, allMatches, user, onDeleteClick }) => {
    const [selectedTournament, setSelectedTournament] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [newTournamentName, setNewTournamentName] = useState("");

    const handleCreateTournament = async () => {
        if (!user || !newTournamentName.trim()) return;
        
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tournaments'), {
            name: newTournamentName,
            createdAt: serverTimestamp(),
            groups: [], // [{ id, name, teams: [], settings: { classifiedSlots: 2 } }]
            knockout: null // { type: 8, matches: [] }
        });
        
        setNewTournamentName("");
        setIsCreating(false);
    };
    
    // Si un torneo está seleccionado, muestra el detalle
    if (selectedTournament) {
        return (
            <TournamentDetailView 
                tournament={selectedTournament}
                onBack={() => setSelectedTournament(null)}
                user={user}
                allTeams={allTeams}
                allMatches={allMatches}
                onDeleteTournament={onDeleteClick}
            />
        );
    }

    // Vista de lista de torneos
    return (
        <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-green-900">Torneos</h2>
                <Button onClick={() => setIsCreating(!isCreating)}>
                    {isCreating ? 'Cancelar' : <><Plus size={16} /> Nuevo Torneo</>}
                </Button>
            </div>

            {isCreating && (
                <Card className="p-6 mb-6 shadow-lg animate-in slide-in-from-top-2">
                    <div className="flex gap-4">
                        <Input 
                            label="Nombre del Torneo" 
                            placeholder="Ej: Copa de Verano 2026"
                            value={newTournamentName}
                            onChange={(e) => setNewTournamentName(e.target.value)}
                        />
                        <Button onClick={handleCreateTournament} className="self-end mb-3">Crear</Button>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tournaments.length === 0 && !isCreating && (
                    <p className="text-gray-500">No hay torneos creados. ¡Crea uno nuevo!</p>
                )}
                {tournaments.map(t => (
                    <div key={t.id} 
                         className="bg-white border border-green-100 p-5 rounded-xl hover:border-green-400 hover:shadow-md transition-all cursor-pointer flex justify-between items-center"
                         onClick={() => setSelectedTournament(t)}
                    >
                        <div>
                            <div className="flex items-center gap-2 text-green-800">
                                <Shield size={20} />
                                <span className="text-lg font-bold">{t.name}</span>
                            </div>
                            <span className="text-xs text-gray-500 ml-7">{t.groups.length} Grupos, {t.knockout ? `${t.knockout.type} equipos` : 'Sin eliminatoria'}</span>
                        </div>
                        <Trash2 
                            size={18} 
                            className="text-gray-400 hover:text-red-600 transition-colors" 
                            onClick={(e) => { e.stopPropagation(); onDeleteClick(t.id); }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
  };
  
  // --- NUEVO: Vista de Detalle de Torneo (Componente interno) ---
  const TournamentDetailView = ({ tournament, onBack, user, allTeams, allMatches, onDeleteTournament }) => {
    const [view, setView] = useState('groups'); // 'groups' or 'knockout'
    const [isEditMode, setIsEditMode] = useState(true); // --- NUEVO: Modo Edición ---
    
    const [groupForm, setGroupForm] = useState({ name: '', classifiedSlots: 2 });
    const [teamToAdd, setTeamToAdd] = useState({ groupId: null, teamId: '' });
    // --- MODIFICADO: Añadir jornada al form ---
    const [matchForm, setMatchForm] = useState({ groupId: null, teamAId: '', teamBId: '', startTime: '', jornada: '' });
    const [knockoutSetup, setKnockoutSetup] = useState(tournament.knockout ? tournament.knockout.type : 8);

    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tournaments', tournament.id);

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
        
        // Encontrar el grupo y añadir el equipo
        const newGroups = tournament.groups.map(g => {
            if (g.id === groupId) {
                if (g.teams.includes(teamToAdd.teamId)) return g; // Evitar duplicados
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
        
        // --- NUEVO: Obtener nombre del grupo ---
        const group = tournament.groups.find(g => g.id === matchForm.groupId);

        // Crear el partido en la colección 'matches'
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'matches'), {
            teamAId: matchForm.teamAId,
            teamBId: matchForm.teamBId,
            startTime: matchForm.startTime,
            status: 'scheduled',
            autoStart: true,
            scoreA: 0, scoreB: 0,
            currentMinute: 0, events: [], period: '1T', 
            addedTime: 0, halftimeCounter: 0, 
            createdAt: serverTimestamp(),
            // --- Datos del Torneo ---
            tournamentId: tournament.id,
            groupId: matchForm.groupId,
            groupName: group ? group.name : null, // --- NUEVO ---
            jornada: matchForm.jornada || null, // --- NUEVO ---
            seriesId: null,
            matchType: 'group', 
        });
        
        // --- MODIFICADO: Resetear jornada ---
        setMatchForm({ groupId: null, teamAId: '', teamBId: '', startTime: '', jornada: '' });
    };

    const handleSetupKnockout = async () => {
        const type = parseInt(knockoutSetup, 10);
        const matchesCount = type / 2;
        const newKnockout = {
            type: type,
            matches: Array.from({ length: matchesCount }, (_, i) => ({
                id: `ko-match-${i+1}`,
                name: `Partido ${i+1}`, // Ej: Cuartos 1
                teamA: null,
                teamB: null,
                matchId: null // ID del partido real
            }))
        };
        await updateDoc(docRef, { knockout: newKnockout });
    };
    
    // --- NUEVO: Actualizar enfrentamiento de eliminatoria ---
    const handleUpdateKnockoutMatch = async (koMatchId, teamSide, teamId) => {
        if (!tournament.knockout) return;
        
        const newMatches = tournament.knockout.matches.map(m => {
            if (m.id === koMatchId) {
                return { ...m, [teamSide]: teamId || null }; // Poner null si se selecciona 'A definir'
            }
            return m;
        });
        
        const newKnockout = { ...tournament.knockout, matches: newMatches };
        
        await updateDoc(docRef, { knockout: newKnockout });
    };

    const tournamentMatches = allMatches.filter(m => m.tournamentId === tournament.id);
    const teamOptions = [
        { value: '', label: 'A definir...' },
        ...allTeams.map(t => ({ value: t.id, label: t.name }))
    ];

    return (
        <div className="animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <Button variant="secondary" onClick={onBack}>
                    <ArrowLeft size={16} /> Volver a Torneos
                </Button>
                
                {/* --- NUEVO: Toggle Edición/Visual --- */}
                <ToggleSwitch 
                    isEnabled={isEditMode}
                    onToggle={() => setIsEditMode(!isEditMode)}
                    labelLeft="Visual"
                    labelRight="Edición"
                    IconLeft={Eye}
                    IconRight={Edit}
                />
                
                <h2 className="text-2xl font-bold text-green-900 hidden md:block">{tournament.name}</h2>
                
                {isEditMode && (
                    <Button variant="danger" onClick={() => onDeleteTournament(tournament.id)}>
                        <Trash2 size={16} /> Borrar Torneo
                    </Button>
                )}
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-green-200">
                <button onClick={() => setView('groups')} className={`pb-2 px-4 text-sm font-bold ${view === 'groups' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>
                    Fase de Grupos
                </button>
                <button onClick={() => setView('knockout')} className={`pb-2 px-4 text-sm font-bold ${view === 'knockout' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500'}`}>
                    Eliminatoria
                </button>
            </div>

            {/* --- VISTA DE GRUPOS --- */}
            {view === 'groups' && (
                <div className="space-y-8">
                    {/* Formulario Añadir Grupo (Solo Modo Edición) */}
                    {isEditMode && (
                        <Card className="p-4 bg-gray-50">
                            <h3 className="font-bold text-green-800 mb-2">Añadir Nuevo Grupo</h3>
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-green-600">Nombre del Grupo</label>
                                    <SmallInput 
                                        placeholder="Ej: Grupo A" 
                                        value={groupForm.name}
                                        onChange={e => setGroupForm({...groupForm, name: e.target.value})}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-green-600">Cupos Clasificación</label>
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
                    {tournament.groups.map(group => {
                        const standings = calculateStandings(group.id, group.teams, allTeams, tournamentMatches);
                        const groupMatches = tournamentMatches.filter(m => m.groupId === group.id).reverse();
                        const teamsInGroup = group.teams.map(id => allTeams.find(t => t.id === id)).filter(Boolean);
                        const availableTeams = allTeams.filter(t => !group.teams.includes(t.id));

                        return (
                            <Card key={group.id} className="p-6">
                                <h3 className="text-xl font-bold text-red-700 mb-4">{group.name}</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Izquierda: Tabla y Equipos */}
                                    <div>
                                        <h4 className="font-bold text-green-800 mb-3">Tabla de Posiciones</h4>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm divide-y divide-gray-200">
                                                <thead className="bg-green-50">
                                                    <tr>
                                                        <th className="px-2 py-2 text-left text-xs font-bold text-green-700 uppercase tracking-wider">#</th>
                                                        <th className="px-2 py-2 text-left text-xs font-bold text-green-700 uppercase tracking-wider">Equipo</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold text-green-700 uppercase tracking-wider">PJ</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold text-green-700 uppercase tracking-wider">G</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold text-green-700 uppercase tracking-wider">E</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold text-green-700 uppercase tracking-wider">P</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold text-green-700 uppercase tracking-wider">DG</th>
                                                        <th className="px-2 py-2 text-center text-xs font-bold text-green-700 uppercase tracking-wider">Pts</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-100">
                                                    {standings.map((t, index) => (
                                                        <tr key={t.id} className={index < group.settings.classifiedSlots ? 'bg-green-50' : ''}>
                                                            <td className="px-2 py-2 whitespace-nowrap text-center">
                                                                {index + 1}
                                                                {index < group.settings.classifiedSlots && <CheckSquare size={14} className="text-green-600 inline-block ml-1" />}
                                                            </td>
                                                            <td className="px-2 py-2 whitespace-nowrap font-medium text-green-900 flex items-center gap-2">
                                                                <img src={t.logo || `https://ui-avatars.com/api/?name=${t.name}`} className="w-5 h-5 rounded-full object-cover" />
                                                                {t.name}
                                                                {/* --- MODIFICADO: Ocultar en modo visual --- */}
                                                                {isEditMode && (
                                                                    <Trash2 size={14} className="text-gray-400 hover:text-red-600 cursor-pointer" onClick={() => handleRemoveTeamFromGroup(group.id, t.id)} />
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

                                        {/* Añadir Equipo (Solo Modo Edición) */}
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
                                    <div className={isEditMode ? "border-l border-green-100 pl-8" : ""}>
                                        {/* Formulario Programar Partido (Solo Modo Edición) */}
                                        {isEditMode && (
                                            <>
                                                <h4 className="font-bold text-green-800 mb-3">Programar Partido</h4>
                                                <div className="space-y-2 p-3 bg-green-50 rounded-lg">
                                                    <SmallSelect options={[{ value: '', label: 'Local...' }, ...teamsInGroup.map(t => ({ value: t.id, label: t.name }))]} value={matchForm.groupId === group.id ? matchForm.teamAId : ''} onChange={e => setMatchForm({...matchForm, groupId: group.id, teamAId: e.target.value, teamBId: e.target.value === matchForm.teamBId ? '' : matchForm.teamBId})} />
                                                    <SmallSelect options={[{ value: '', label: 'Visitante...' }, ...teamsInGroup.filter(t => t.id !== matchForm.teamAId).map(t => ({ value: t.id, label: t.name }))]} value={matchForm.groupId === group.id ? matchForm.teamBId : ''} onChange={e => setMatchForm({...matchForm, groupId: group.id, teamBId: e.target.value})} />
                                                    <SmallInput type="datetime-local" value={matchForm.groupId === group.id ? matchForm.startTime : ''} onChange={e => setMatchForm({...matchForm, groupId: group.id, startTime: e.target.value})} />
                                                    {/* --- NUEVO: Input Jornada --- */}
                                                    <SmallInput type="number" min="1" placeholder="Jornada #" value={matchForm.groupId === group.id ? matchForm.jornada : ''} onChange={e => setMatchForm({...matchForm, groupId: group.id, jornada: e.target.value})} />
                                                    <Button onClick={handleScheduleMatch} className="w-full" disabled={matchForm.groupId !== group.id}><Calendar size={16}/> Programar</Button>
                                                </div>
                                            </>
                                        )}
                                        
                                        <h4 className="font-bold text-green-800 mt-6 mb-3">Partidos del Grupo</h4>
                                        <div className={`space-y-2 ${isEditMode ? 'max-h-48 overflow-y-auto' : ''}`}>
                                            {groupMatches.length === 0 && <p className="text-xs text-gray-500">No hay partidos programados para este grupo.</p>}
                                            {groupMatches.map(m => {
                                                const tA = allTeams.find(t => t.id === m.teamAId);
                                                const tB = allTeams.find(t => t.id === m.teamBId);
                                                return (
                                                    <div key={m.id} className="text-sm p-2 bg-white border border-gray-100 rounded flex justify-between items-center">
                                                        <div className="flex items-center gap-2">
                                                            {m.jornada && <span className="text-xs font-bold text-gray-400">J{m.jornada}</span>}
                                                            <span className="font-bold">{tA?.shortName || '?'}</span> {m.scoreA} - {m.scoreB} <span className="font-bold">{tB?.shortName || '?'}</span>
                                                        </div>
                                                        <Badge status={m.status} period={m.period} />
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
                    {/* Formulario Configurar (Solo Modo Edición) */}
                    {isEditMode && (
                        <Card className="p-6">
                            <h3 className="font-bold text-green-800 mb-3">Configurar Eliminatoria</h3>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="text-[10px] font-bold text-green-600">Equipos en Fase Final</label>
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
                        </Card>
                    )}

                    {tournament.knockout && (
                        <Card className="p-6">
                             <h3 className="text-xl font-bold text-red-700 mb-4">Cuadro de {tournament.knockout.type} Equipos</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {tournament.knockout.matches.map(koMatch => (
                                    <div key={koMatch.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                        <div className="font-bold text-sm text-green-800 mb-2">{koMatch.name}</div>
                                        
                                        {/* --- MODIFICADO: Renderizado Condicional Edición/Visual --- */}
                                        {isEditMode ? (
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
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between p-2 bg-white rounded text-sm">
                                                <span className={!koMatch.teamA ? 'text-gray-400' : 'font-medium'}>
                                                    {koMatch.teamA ? (allTeams.find(t => t.id === koMatch.teamA)?.name || 'Equipo A') : 'A definir'}
                                                </span>
                                                <span className="font-bold text-gray-400 text-xs">vs</span>
                                                <span className={!koMatch.teamB ? 'text-gray-400' : 'font-medium'}>
                                                    {koMatch.teamB ? (allTeams.find(t => t.id === koMatch.teamB)?.name || 'Equipo B') : 'A definir'}
                                                </span>
                                            </div>
                                        )}
                                        {/* Aquí se podría añadir lógica para vincular partidos */}
                                    </div>
                                ))}
                             </div>
                        </Card>
                    )}
                </div>
            )}
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
  
  // --- MODIFICADO: Menú y Renderizado Principal ---
  const navItems = [
    { id: 'dashboard', icon: Activity, label: 'Inicio' },
    { id: 'tournaments', icon: Shield, label: 'Torneos' }, 
    { id: 'teams', icon: Users, label: 'Clubes' },
    { id: 'matches', icon: Calendar, label: 'Partidos' }
  ];

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
        message="El partido será eliminado del historial permanentemente. Si es parte de una serie de Ida/Vuelta, el otro partido NO será borrado."
        onClose={() => setDeleteMatchId(null)}
        onConfirm={async () => {
            if(user) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'matches', deleteMatchId));
        }}
      />
      {/* --- NUEVO: Modal Borrar Torneo --- */}
      <ConfirmModal 
        isOpen={!!deleteTournamentId} 
        title="¿Eliminar Torneo?" 
        message="Esta acción borrará el torneo, sus grupos y configuración. LOS PARTIDOS DEL TORNEO NO SERÁN BORRADOS de la lista general."
        onClose={() => setDeleteTournamentId(null)}
        onConfirm={async () => {
            if(user) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tournaments', deleteTournamentId));
        }}
      />

      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-green-800 flex-col p-6 z-50 shadow-2xl border-r border-green-700">
        <div className="flex flex-col items-center mb-10 text-white border-b border-green-700 pb-6">
          <img 
              src="https://i.postimg.cc/T1xy0cy4/IMG-4967.png" 
              className="w-24 h-24 object-contain"
              alt="Logo"
          />
          <h1 className="text-center font-black italic text-lg leading-tight tracking-tight">COPA DE LOS <br/><span className="text-red-500 bg-white px-1 rounded-sm inline-block mt-1 transform -skew-x-12 shadow-sm">REYES 2026</span></h1>
        </div>
        <nav className="space-y-2 flex-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setView(item.id); setSelectedMatchId(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-bold uppercase tracking-wide ${view === item.id ? 'bg-white text-green-800 shadow-md' : 'text-green-100 hover:bg-green-700 hover:text-white'}`}>
              <item.icon size={18} className={view === item.id ? "text-red-600" : ""} /> {item.label}
            </button>
          ))}
        </nav>
        <div className="text-[10px] text-center text-green-300 uppercase font-bold tracking-wider">v5.1 Edición</div>
      </div>
      <div className="md:hidden bg-green-800 p-4 flex justify-between items-center sticky top-0 z-40 shadow-md">
         <div className="flex items-center gap-2 text-white font-black italic"><img 
              src="https://i.postimg.cc/T1xy0cy4/IMG-4967.png" 
              className="w-10 h-10 object-contain"
              alt="Logo"
            /> <span className="text-3xl">COPA REYES</span></div>
         <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white">{mobileMenuOpen ? <X /> : <Menu />}</button>
      </div>
      {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-green-900/95 z-50 flex flex-col items-center justify-center gap-8">
              <button onClick={() => setMobileMenuOpen(false)} className="absolute top-4 right-4 text-white"><X size={32} /></button>
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setView(item.id); setSelectedMatchId(null); setMobileMenuOpen(false); }} className="text-2xl font-bold text-white uppercase tracking-widest hover:text-yellow-400">{item.label}</button>
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