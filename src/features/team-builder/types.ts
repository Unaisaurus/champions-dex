import type { TeamMember } from '@/domain/team';

/** Changes the member being edited (the change shows at once and is saved a moment later). */
export type MemberChange = (change: (member: TeamMember) => TeamMember) => void;
