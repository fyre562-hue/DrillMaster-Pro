import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Competition, Team, Event } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { CheckCircle, AlertCircle, Save, Printer } from 'lucide-react';

interface Props {
  competition: Competition;
  event: Event;
  team: Team;
  judgeNumber: string;
  isInteractive?: boolean;
}

const PrintableScoresheet: React.FC<Props> = ({ competition, event, team, judgeNumber, isInteractive = false }) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
  });

  const [scores, setScores] = useState<Record<string, number>>({});
  const [penaltiesApplied, setPenaltiesApplied] = useState<Record<string, number>>({});
  const [reportIn, setReportIn] = useState(0);
  const [reportOut, setReportOut] = useState(0);
  const [techImpression, setTechImpression] = useState(0);
  const [precImpression, setPrecImpression] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleScoreChange = (cmdId: string, val: number) => {
    setScores(prev => ({ ...prev, [cmdId]: val }));
  };

  const handlePenaltyChange = (pId: string, count: number) => {
    setPenaltiesApplied(prev => ({ ...prev, [pId]: count }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      await addDoc(collection(db, 'submissions'), {
        competitionId: competition.id,
        eventId: event.id,
        teamId: team.id,
        judgeId: judgeNumber,
        scores,
        penaltiesApplied,
        reportIn,
        reportOut,
        technicalImpression: techImpression,
        precisionImpression: precImpression,
        timestamp: serverTimestamp(),
      });
      setSubmitSuccess(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
      setSubmitError('Failed to submit scores. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Split commands into two columns (1-26 and 27-50 as per the reference image)
  const commands = Array.isArray(event.commands) ? event.commands : [];
  const leftCommands = commands.slice(0, 26);
  const rightCommands = commands.slice(26, 50);

  const totalScore = Object.values(scores).reduce((a, b) => (a as number) + (b as number), 0) as number + reportIn + reportOut + techImpression + precImpression;

  const totalPenalties = Object.entries(penaltiesApplied).reduce((acc, [pId, count]) => {
    const p = event.penalties.find(pen => pen.id === pId);
    return acc + (p ? p.deduction * (count as number) : 0);
  }, 0);

  return (
    <div className="p-4 bg-zinc-100 min-h-screen">
      <div className="max-w-[800px] mx-auto mb-4 flex justify-between items-center no-print bg-white p-4 rounded-lg shadow-sm border border-zinc-200">
        <div className="flex gap-2">
          <button 
            onClick={() => handlePrint()}
            className="px-4 py-2 bg-zinc-900 text-white rounded font-bold uppercase text-xs tracking-widest hover:bg-zinc-800 transition-colors flex items-center gap-2"
          >
            <Printer size={16} /> Print Sheet
          </button>
          
          {isInteractive && (
            <button 
              onClick={handleSubmit}
              disabled={submitting || submitSuccess}
              className={`px-4 py-2 rounded font-bold uppercase text-xs tracking-widest transition-all flex items-center gap-2 ${
                submitSuccess 
                  ? 'bg-green-600 text-white' 
                  : 'bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50'
              }`}
            >
              {submitting ? 'Submitting...' : submitSuccess ? <><CheckCircle size={16} /> Submitted</> : <><Save size={16} /> Submit Scores</>}
            </button>
          )}
        </div>
        
        {submitError && (
          <div className="text-red-600 text-xs font-bold flex items-center gap-1">
            <AlertCircle size={14} /> {submitError}
          </div>
        )}
      </div>

      <div ref={componentRef} className="print:p-8 bg-white text-black font-serif text-[10px] leading-tight max-w-[800px] mx-auto border-2 border-black p-4 shadow-xl">
        {/* Header Section */}
        <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2">
          <div className="w-16 h-16 bg-zinc-100 flex items-center justify-center text-[8px] border border-black font-sans font-bold">
            JROTC LOGO
          </div>
          <div className="text-center flex-1 px-4">
            <h1 className="text-lg font-bold uppercase tracking-tighter">{competition.name}</h1>
            <h2 className="text-sm italic font-sans">{event.name} - {team.division} Division</h2>
          </div>
          <div className="border-2 border-black p-2 text-center min-w-[100px]">
            <div className="text-[8px] uppercase font-sans font-bold">REG TOTAL</div>
            <div className="h-8 flex items-center justify-center text-xl font-bold font-sans">
              {totalScore}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-2 font-sans">
          <div>
            <div className="flex gap-2 mb-1">
              <span className="font-bold">School Name:</span>
              <span className="border-b border-black flex-1">{team.schoolName}</span>
            </div>
            <div className="flex gap-2 mb-1">
              <span className="font-bold">Team Name:</span>
              <span className="border-b border-black flex-1">{team.teamName}</span>
            </div>
            <div className="flex gap-2">
              <span className="font-bold">Code:</span>
              <span className="border-b border-black w-20"></span>
              <span className="font-bold ml-4">Head Judge #</span>
              <span className="border-b border-black w-10">{judgeNumber}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold">Total Points = 400</div>
          </div>
        </div>

        {/* Command Grid */}
        <div className="grid grid-cols-2 gap-0 border-t-2 border-black font-sans">
          {/* Left Column */}
          <div className="border-r border-black">
            <div className="grid grid-cols-[1fr_repeat(7,24px)] bg-zinc-100 border-b border-black">
              <div className="px-1 font-bold uppercase text-[8px] flex items-center">Team Enters & Reports In*</div>
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <div key={n} className="border-l border-black text-center font-bold text-[9px]">{n}</div>
              ))}
            </div>
            {leftCommands.map((cmd, idx) => cmd ? (
              <div key={cmd.id} className="grid grid-cols-[1fr_repeat(7,24px)] border-b border-black group">
                <div className="px-1 truncate text-[9px] flex items-center">{idx + 1}. {cmd.text}</div>
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <div 
                    key={n} 
                    onClick={() => isInteractive && handleScoreChange(cmd.id, n)}
                    className={`border-l border-black h-5 cursor-pointer flex items-center justify-center text-[9px] font-bold ${isInteractive ? 'hover:bg-orange-100' : ''} ${scores[cmd.id] === n ? 'bg-zinc-900 text-white' : ''}`}
                  >
                    {scores[cmd.id] === n ? n : ''}
                  </div>
                ))}
              </div>
            ) : null)}
            {/* Fill empty rows to reach 26 */}
            {Array.from({ length: Math.max(0, 26 - leftCommands.length) }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_repeat(7,24px)] border-b border-black">
                <div className="px-1 text-zinc-300 text-[9px]">{leftCommands.length + i + 1}. ________________</div>
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <div key={n} className="border-l border-black h-5"></div>
                ))}
              </div>
            ))}
          </div>

          {/* Right Column */}
          <div>
            <div className="grid grid-cols-[1fr_repeat(7,24px)] bg-zinc-100 border-b border-black">
              <div className="px-1 font-bold uppercase text-[8px] flex items-center">Commands Continued</div>
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <div key={n} className="border-l border-black text-center font-bold text-[9px]">{n}</div>
              ))}
            </div>
            {rightCommands.map((cmd, idx) => cmd ? (
              <div key={cmd.id} className="grid grid-cols-[1fr_repeat(7,24px)] border-b border-black group">
                <div className="px-1 truncate text-[9px] flex items-center">{idx + 27}. {cmd.text}</div>
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <div 
                    key={n} 
                    onClick={() => isInteractive && handleScoreChange(cmd.id, n)}
                    className={`border-l border-black h-5 cursor-pointer flex items-center justify-center text-[9px] font-bold ${isInteractive ? 'hover:bg-orange-100' : ''} ${scores[cmd.id] === n ? 'bg-zinc-900 text-white' : ''}`}
                  >
                    {scores[cmd.id] === n ? n : ''}
                  </div>
                ))}
              </div>
            ) : null)}
             {/* Fill empty rows to reach 50 */}
             {Array.from({ length: Math.max(0, 24 - rightCommands.length) }).map((_, i) => (
              <div key={i} className="grid grid-cols-[1fr_repeat(7,24px)] border-b border-black">
                <div className="px-1 text-zinc-300 text-[9px]">{27 + rightCommands.length + i}. ________________</div>
                {[1, 2, 3, 4, 5, 6, 7].map(n => (
                  <div key={n} className="border-l border-black h-5"></div>
                ))}
              </div>
            ))}
            <div className="grid grid-cols-[1fr_repeat(7,24px)] bg-zinc-100 border-b border-black">
              <div className="px-1 font-bold uppercase text-[8px] flex items-center">Team Reports Out & Exits*</div>
              {[1, 2, 3, 4, 5, 6, 7].map(n => (
                <div key={n} className="border-l border-black h-5"></div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Scoring */}
        <div className="grid grid-cols-[2fr_1fr] gap-4 mt-4 font-sans">
          <div className="border-2 border-black p-2">
            <div className="font-bold uppercase text-center border-b border-black mb-2 text-[9px]">Judges Score All Four Items Below plus Cadet CDR Score</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[9px]">Report IN score (0-15)</span>
                  {isInteractive ? (
                    <input type="number" min="0" max="15" value={reportIn} onChange={e => setReportIn(Number(e.target.value))} className="border-b border-black w-12 text-center outline-none" />
                  ) : (
                    <span className="border-b border-black w-16"></span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px]">Report OUT score (0-15)</span>
                  {isInteractive ? (
                    <input type="number" min="0" max="15" value={reportOut} onChange={e => setReportOut(Number(e.target.value))} className="border-b border-black w-12 text-center outline-none" />
                  ) : (
                    <span className="border-b border-black w-16"></span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-[7px] leading-tight">Technical Impression (0-10)<br/>(adherence to service/meet regulations)</div>
                  {isInteractive ? (
                    <input type="number" min="0" max="10" value={techImpression} onChange={e => setTechImpression(Number(e.target.value))} className="border-b border-black w-12 text-center outline-none" />
                  ) : (
                    <span className="border-b border-black w-16 h-6"></span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-[7px] leading-tight">Precision Impression (0-10)<br/>(overall precision displayed by unit)</div>
                  {isInteractive ? (
                    <input type="number" min="0" max="10" value={precImpression} onChange={e => setPrecImpression(Number(e.target.value))} className="border-b border-black w-12 text-center outline-none" />
                  ) : (
                    <span className="border-b border-black w-16 h-6"></span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="border-2 border-black p-2 text-[7px]">
            <div className="font-bold text-center mb-1 uppercase">NOTE: COMPLETE THIS BOX ONLY IF TEAM HAS INCORRECT # OF CADETS!</div>
            <div className="text-center">12 cadets + C/Cmdr. Required</div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="border border-black p-1 text-center leading-tight">ONE CADET OVER / UNDER<br/><span className="font-bold text-[9px]">-25</span></div>
              <div className="border border-black p-1 text-center leading-tight">TWO CADETS OVER / UNDER<br/><span className="font-bold text-[9px]">-50</span></div>
            </div>
            <div className="mt-2">C/Cmdr. Initials: ________</div>
          </div>
        </div>

        {/* Penalties Section */}
        <div className="grid grid-cols-[2fr_1fr] gap-0 mt-2 border-2 border-black font-sans">
          <div className="p-2 border-r border-black">
            <div className="font-bold italic uppercase mb-2 text-[9px]">Penalties (list number of occurrences)</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {(Array.isArray(event.penalties) ? event.penalties : []).map(p => p ? (
                <div key={p.id} className="flex items-center gap-2">
                  {isInteractive ? (
                    <input 
                      type="number" 
                      min="0" 
                      value={penaltiesApplied[p.id] || 0} 
                      onChange={e => handlePenaltyChange(p.id, Number(e.target.value))} 
                      className="border-b border-black w-8 text-center outline-none text-[9px]" 
                    />
                  ) : (
                    <span className="border-b border-black w-8 text-center"></span>
                  )}
                  <span className="text-[8px]">{p.name} ({p.deduction > 0 ? '-' : ''}{p.deduction} ea)</span>
                </div>
              ) : null)}
            </div>
            <div className="mt-4 text-[8px]">Specify Uniform Deduction: ________________________________</div>
          </div>
          <div className="grid grid-rows-2">
            <div className="grid grid-cols-2 border-b border-black">
              <div className="border-r border-black p-1 text-center font-bold text-[7px] uppercase flex items-center justify-center">Total Penalty Points</div>
              <div className="p-1 text-center font-bold text-[7px] uppercase flex items-center justify-center">JUDGE PAGE TOTAL</div>
            </div>
            <div className="grid grid-cols-2">
              <div className="border-r border-black flex items-center justify-center font-bold text-sm">
                {totalPenalties}
              </div>
              <div className="flex items-center justify-center font-bold text-sm">
                {/* Final calculated score could go here */}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-end font-sans">
          <div className="flex-1">
            <div className="text-[9px]">Judge's Name: ________________________________________________</div>
            <div className="mt-2 text-[9px]">Notes: __________________________________________________</div>
          </div>
          <div className="text-[8px] italic font-bold">
            {team.schoolName} • JUDGE #{judgeNumber}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintableScoresheet;
