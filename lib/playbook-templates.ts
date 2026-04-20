/**
 * Message templates for Coach Playbook
 * Variables: [Athlete], [Parent], [Coach], [Date], [Time], [Facility]
 */

export type PlaybookActionType = 
  | 'welcome_athlete'
  | 'welcome_parent'
  | 'pre_session_athlete'
  | 'pre_session_parent'
  | 'pre_session_broadcast'
  | 'post_session_athlete'
  | 'post_session_parent'
  | 'review_request'
  | 'birthday'
  | 'birthday_parent';

export interface MessageTemplate {
  type: PlaybookActionType;
  label: string;
  recipient: 'athlete' | 'parent';
  template: string;
}

export const PLAYBOOK_TEMPLATES: MessageTemplate[] = [
  // Welcome messages
  {
    type: 'welcome_athlete',
    label: 'Welcome Athlete',
    recipient: 'athlete',
    template: `Hey [Athlete]! This is Coach [Coach] from The Guild. Excited to work with you on [Date] at [Time]. Let me know if you have any questions before then!`,
  },
  {
    type: 'welcome_parent',
    label: 'Welcome Parent',
    recipient: 'parent',
    template: `Hi [Parent]! This is Coach [Coach] from The Guild. Looking forward to working with [Athlete] on [Date] at [Time] at [Facility]. Feel free to reach out if you have any questions!`,
  },

  // Pre-session reminders
  {
    type: 'pre_session_athlete',
    label: 'Remind Athlete',
    recipient: 'athlete',
    template: `Hey [Athlete]! Just a reminder — we're on for tomorrow at [Time] at [Facility]. Bring your wrestling shoes and water. See you there!`,
  },
  {
    type: 'pre_session_parent',
    label: 'Remind Parent',
    recipient: 'parent',
    template: `Hi [Parent]! Quick reminder that [Athlete] has a session with Coach [Coach] tomorrow at [Time] at [Facility]. See you there!`,
  },
  /** One text to parents + athletes: neutral wording (no “Hey [Athlete]” when the To: line is a parent). */
  {
    type: 'pre_session_broadcast',
    label: 'Session reminder (group text)',
    recipient: 'parent',
    template: `Coach [Coach] (The Guild) — reminder: [Athlete] @ [Date] [Time], [Facility]. See you there!`,
  },

  // Post-session follow-ups
  {
    type: 'post_session_athlete',
    label: 'Follow-up Athlete',
    recipient: 'athlete',
    template: `Great work today [Athlete]! Keep drilling those moves we worked on. Let me know when you want to get back on the mat!`,
  },
  {
    type: 'post_session_parent',
    label: 'Follow-up Parent',
    recipient: 'parent',
    template: `Hi [Parent]! [Athlete] did great today. Happy to answer any questions or help book the next session. Looking forward to more work on the mat!`,
  },

  // Review request
  {
    type: 'review_request',
    label: 'Request Review',
    recipient: 'parent',
    template: `Hi [Parent]! Hope [Athlete] enjoyed the session. If you have a moment, a quick review would really help other families find us. Thanks so much!`,
  },

  // Birthday
  {
    type: 'birthday',
    label: 'Happy Birthday',
    recipient: 'athlete',
    template: `Happy Birthday [Athlete]! Hope you have an awesome day. Looking forward to seeing you on the mat soon!`,
  },
  {
    type: 'birthday_parent',
    label: 'Birthday (parent)',
    recipient: 'parent',
    template: `Hi [Parent]! Please wish [Athlete] a happy birthday from Coach [Coach] — hope they have a great day. See you on the mat soon!`,
  },
];

/**
 * Replace template variables with actual values
 */
export function fillTemplate(
  template: string,
  variables: {
    athleteName?: string;
    parentName?: string;
    coachName?: string;
    date?: string;
    time?: string;
    facility?: string;
  }
): string {
  let filled = template;
  
  if (variables.athleteName) {
    filled = filled.replace(/\[Athlete\]/g, variables.athleteName);
  }
  if (variables.parentName) {
    filled = filled.replace(/\[Parent\]/g, variables.parentName);
  }
  if (variables.coachName) {
    filled = filled.replace(/\[Coach\]/g, variables.coachName);
  }
  if (variables.date) {
    filled = filled.replace(/\[Date\]/g, variables.date);
  }
  if (variables.time) {
    filled = filled.replace(/\[Time\]/g, variables.time);
  }
  if (variables.facility) {
    filled = filled.replace(/\[Facility\]/g, variables.facility);
  }
  
  return filled;
}

/**
 * Get template by type
 */
export function getTemplate(type: PlaybookActionType): MessageTemplate | undefined {
  return PLAYBOOK_TEMPLATES.find(t => t.type === type);
}
