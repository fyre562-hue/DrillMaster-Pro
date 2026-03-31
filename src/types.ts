export interface Command {
  id: string;
  text: string;
  maxPoints: number;
}

export interface Penalty {
  id: string;
  name: string;
  deduction: number;
}

export interface Team {
  id: string;
  schoolName: string;
  teamName: string;
  division: string;
}

export interface Event {
  id: string;
  name: string; // e.g., "Honor Guard", "Inspection"
  commands: Command[];
  penalties: Penalty[];
  enrolledTeamIds: string[]; // IDs of teams enrolled in this specific event
}

export interface Competition {
  id: string;
  name: string;
  date: string;
  pin: string;
  events: Event[];
  teams: Team[]; // Global list of teams for this competition
}

export interface ScoreSubmission {
  id: string;
  competitionId: string;
  eventId: string;
  teamId: string;
  judgeId: string;
  scores: Record<string, number>;
  penaltiesApplied: Record<string, number>;
  reportIn: number;
  reportOut: number;
  technicalImpression: number;
  precisionImpression: number;
  timestamp: string;
}
