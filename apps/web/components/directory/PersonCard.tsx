'use client';

import type { DirectoryUser } from '../../lib/org/types';
import { ROLE_LABEL } from '../../lib/users/types';
import { useOrg } from '../../lib/org/OrgProvider';
import { Card } from '../ui/Card';

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function PersonCard({ person, onSelect }: { person: DirectoryUser; onSelect: (person: DirectoryUser) => void }) {
  const { getDivisionName, getSectionName, getCelluleName } = useOrg();

  const orgUnit = person.celluleId
    ? getCelluleName(person.celluleId)
    : [getDivisionName(person.divisionId), getSectionName(person.sectionId)].filter(Boolean).join(' · ');

  return (
    <Card className="cursor-pointer p-4 transition-colors hover:border-accent" onClick={() => onSelect(person)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gold text-[13px] font-bold text-ink">
          {initials(person.firstName, person.lastName)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-bold">
            {person.firstName} {person.lastName}
          </div>
          <div className="truncate text-[12px] text-text-muted">
            {person.jobTitle ?? ROLE_LABEL[person.role as keyof typeof ROLE_LABEL] ?? person.role}
          </div>
        </div>
      </div>
      {orgUnit && <div className="mt-2.5 truncate text-[11.5px] text-text-faint">{orgUnit}</div>}
    </Card>
  );
}
