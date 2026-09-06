'use client';

import { useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import { createDivision, createSection, deleteDivision, deleteSection, updateDivision, updateSection } from '../../lib/api/org';
import type { Division, Section } from '../../lib/org/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { OrgEntityFormModal } from './OrgEntityFormModal';

export function DivisionsPanel() {
  const { divisions, sections, refreshOrg } = useOrg();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creatingDivision, setCreatingDivision] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [creatingSectionFor, setCreatingSectionFor] = useState<Division | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleDeleteDivision(division: Division) {
    if (!window.confirm(`Supprimer la division "${division.name}" ?`)) return;
    setPendingDeleteId(division.id);
    setError(null);
    try {
      await deleteDivision(division.id);
      await refreshOrg();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer cette division');
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function handleDeleteSection(section: Section) {
    if (!window.confirm(`Supprimer la section "${section.name}" ?`)) return;
    setPendingDeleteId(section.id);
    setError(null);
    try {
      await deleteSection(section.id);
      await refreshOrg();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossible de supprimer cette section');
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold">Divisions</h2>
        <Button variant="gold" onClick={() => setCreatingDivision(true)}>
          + Nouvelle division
        </Button>
      </div>

      {error && <div className="mb-3 rounded-md bg-clay-soft px-3 py-2.5 text-[13px] text-clay">{error}</div>}

      {divisions.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-text-faint">Aucune division.</p>
      ) : (
        <div className="space-y-3">
          {divisions.map((division) => {
            const divisionSections = sections.filter((s) => s.divisionId === division.id);
            const isExpanded = expandedId === division.id;
            return (
              <Card key={division.id} className="p-[18px]">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : division.id)}
                    className="flex flex-1 items-center gap-2.5 text-left"
                  >
                    <span className="text-text-faint">{isExpanded ? '▾' : '▸'}</span>
                    <div>
                      <div className="text-[14px] font-bold">{division.name}</div>
                      <div className="text-[12px] text-text-muted">
                        {division.code} · {divisionSections.length} section{divisionSections.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-shrink-0 gap-2">
                    <Button variant="outline" onClick={() => setEditingDivision(division)}>
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      className="border-clay text-clay hover:bg-clay-soft"
                      disabled={pendingDeleteId === division.id}
                      onClick={() => handleDeleteDivision(division)}
                    >
                      Supprimer
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3.5 border-t border-line pt-3.5">
                    <div className="mb-2.5 flex items-center justify-between">
                      <h3 className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Sections</h3>
                      <Button variant="outline" onClick={() => setCreatingSectionFor(division)}>
                        + Section
                      </Button>
                    </div>
                    {divisionSections.length === 0 ? (
                      <p className="text-[12.5px] text-text-faint">Aucune section.</p>
                    ) : (
                      <div className="space-y-2">
                        {divisionSections.map((section) => (
                          <div key={section.id} className="flex items-center justify-between rounded-md bg-bg px-3.5 py-2.5">
                            <div>
                              <div className="text-[13px] font-semibold">{section.name}</div>
                              <div className="text-[11.5px] text-text-faint">{section.code}</div>
                            </div>
                            <div className="flex gap-1.5">
                              <Button variant="outline" onClick={() => setEditingSection(section)}>
                                Modifier
                              </Button>
                              <Button
                                variant="outline"
                                className="border-clay text-clay hover:bg-clay-soft"
                                disabled={pendingDeleteId === section.id}
                                onClick={() => handleDeleteSection(section)}
                              >
                                Supprimer
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {creatingDivision && (
        <OrgEntityFormModal
          title="Nouvelle division"
          codeHint="2 à 10 lettres majuscules, ex. DPE"
          onClose={() => setCreatingDivision(false)}
          onSubmit={async (code, name) => {
            await createDivision({ code, name });
            await refreshOrg();
            setCreatingDivision(false);
          }}
        />
      )}
      {editingDivision && (
        <OrgEntityFormModal
          title="Modifier la division"
          codeHint="2 à 10 lettres majuscules"
          initialCode={editingDivision.code}
          initialName={editingDivision.name}
          onClose={() => setEditingDivision(null)}
          onSubmit={async (code, name) => {
            await updateDivision(editingDivision.id, { code, name });
            await refreshOrg();
            setEditingDivision(null);
          }}
        />
      )}
      {creatingSectionFor && (
        <OrgEntityFormModal
          title={`Nouvelle section — ${creatingSectionFor.name}`}
          codeHint="2 à 10 caractères, ex. SSR"
          onClose={() => setCreatingSectionFor(null)}
          onSubmit={async (code, name) => {
            await createSection(creatingSectionFor.id, { code, name });
            await refreshOrg();
            setExpandedId(creatingSectionFor.id);
            setCreatingSectionFor(null);
          }}
        />
      )}
      {editingSection && (
        <OrgEntityFormModal
          title="Modifier la section"
          codeHint="2 à 10 caractères"
          initialCode={editingSection.code}
          initialName={editingSection.name}
          onClose={() => setEditingSection(null)}
          onSubmit={async (code, name) => {
            await updateSection(editingSection.id, { code, name });
            await refreshOrg();
            setEditingSection(null);
          }}
        />
      )}
    </div>
  );
}
