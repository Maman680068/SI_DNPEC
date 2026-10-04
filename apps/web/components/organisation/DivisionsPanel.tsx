'use client';

import { useState } from 'react';
import { useOrg } from '../../lib/org/OrgProvider';
import {
  createDivision,
  createSection,
  deleteDivision,
  deleteSection,
  reactivateDivision,
  reactivateSection,
  suspendDivision,
  suspendSection,
  updateDivision,
  updateSection,
} from '../../lib/api/org';
import type { Division, Section } from '../../lib/org/types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { OrgEntityFormModal } from './OrgEntityFormModal';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { messageErreur, useToast } from '../ui/Toast';

export function DivisionsPanel() {
  const { divisions, sections, refreshOrg } = useOrg();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creatingDivision, setCreatingDivision] = useState(false);
  const [editingDivision, setEditingDivision] = useState<Division | null>(null);
  const [creatingSectionFor, setCreatingSectionFor] = useState<Division | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const toast = useToast();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  async function handleDeleteDivision(division: Division) {
    if (!window.confirm(`Supprimer la division "${division.name}" ?`)) return;
    setPendingDeleteId(division.id);
    try {
      await deleteDivision(division.id);
      await refreshOrg();
      toast.succes('Division supprimée', { detail: division.name });
    } catch (err) {
      toast.erreur('Suppression impossible', messageErreur(err, 'Impossible de supprimer cette division'));
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function handleDeleteSection(section: Section) {
    if (!window.confirm(`Supprimer la section "${section.name}" ?`)) return;
    setPendingDeleteId(section.id);
    try {
      await deleteSection(section.id);
      await refreshOrg();
      toast.succes('Section supprimée', { detail: section.name });
    } catch (err) {
      toast.erreur('Suppression impossible', messageErreur(err, 'Impossible de supprimer cette section'));
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function handleToggleDivisionActive(division: Division, annulation = false) {
    setPendingDeleteId(division.id);
    try {
      if (division.isActive) await suspendDivision(division.id);
      else await reactivateDivision(division.id);
      await refreshOrg();
      if (!annulation)
        toast.succes(division.isActive ? 'Division suspendue' : 'Division réactivée', {
          detail: division.name,
          annuler: () => handleToggleDivisionActive({ ...division, isActive: !division.isActive }, true),
        });
    } catch (err) {
      toast.erreur('Action impossible', messageErreur(err, 'Impossible de modifier le statut de cette division'));
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function handleToggleSectionActive(section: Section, annulation = false) {
    setPendingDeleteId(section.id);
    try {
      if (section.isActive) await suspendSection(section.id);
      else await reactivateSection(section.id);
      await refreshOrg();
      if (!annulation)
        toast.succes(section.isActive ? 'Section suspendue' : 'Section réactivée', {
          detail: section.name,
          annuler: () => handleToggleSectionActive({ ...section, isActive: !section.isActive }, true),
        });
    } catch (err) {
      toast.erreur('Action impossible', messageErreur(err, 'Impossible de modifier le statut de cette section'));
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="font-heading text-[16px] font-bold text-ink-900">Divisions</h2>
        <Button variant="gold" onClick={() => setCreatingDivision(true)}>
          <Plus aria-hidden size={16} /> Nouvelle division
        </Button>
      </div>


      {divisions.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-text-faint">Aucune division.</p>
      ) : (
        <div className="space-y-3">
          {divisions.map((division) => {
            const divisionSections = sections.filter((s) => s.divisionId === division.id);
            const isExpanded = expandedId === division.id;
            return (
              <Card key={division.id} className="p-[18px]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? null : division.id)}
                    className="flex flex-1 items-center gap-2.5 text-left"
                  >
                    <span aria-hidden className="text-text-faint">{isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold">{division.name}</span>
                        {!division.isActive && (
                          <span className="rounded-full bg-clay-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-clay">
                            Suspendue
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-text-muted">
                        {division.code} · {divisionSections.length} section{divisionSections.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  </button>
                  <div className="flex flex-shrink-0 flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setEditingDivision(division)}>
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      disabled={pendingDeleteId === division.id}
                      onClick={() => handleToggleDivisionActive(division)}
                    >
                      {division.isActive ? 'Suspendre' : 'Réactiver'}
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
                        <Plus aria-hidden size={15} /> Section
                      </Button>
                    </div>
                    {divisionSections.length === 0 ? (
                      <p className="text-[12.5px] text-text-faint">Aucune section.</p>
                    ) : (
                      <div className="space-y-2">
                        {divisionSections.map((section) => (
                          <div
                            key={section.id}
                            className="flex flex-col gap-2 rounded-md bg-bg px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold">{section.name}</span>
                                {!section.isActive && (
                                  <span className="rounded-full bg-clay-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-clay">
                                    Suspendue
                                  </span>
                                )}
                              </div>
                              <div className="text-[11.5px] text-text-faint">{section.code}</div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <Button variant="outline" onClick={() => setEditingSection(section)}>
                                Modifier
                              </Button>
                              <Button
                                variant="outline"
                                disabled={pendingDeleteId === section.id}
                                onClick={() => handleToggleSectionActive(section)}
                              >
                                {section.isActive ? 'Suspendre' : 'Réactiver'}
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
          libelleValider="Créer la division"
          onSubmit={async (code, name) => {
            await createDivision({ code, name });
            await refreshOrg();
            setCreatingDivision(false);
            toast.succes('Division créée', { detail: `${code} — ${name}` });
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
            toast.succes('Division modifiée', { detail: `${code} — ${name}` });
          }}
        />
      )}
      {creatingSectionFor && (
        <OrgEntityFormModal
          title={`Nouvelle section — ${creatingSectionFor.name}`}
          codeHint="2 à 10 caractères, ex. SSR"
          onClose={() => setCreatingSectionFor(null)}
          libelleValider="Créer la section"
          onSubmit={async (code, name) => {
            await createSection(creatingSectionFor.id, { code, name });
            await refreshOrg();
            setExpandedId(creatingSectionFor.id);
            setCreatingSectionFor(null);
            toast.succes('Section créée', { detail: `${code} — ${name}` });
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
            toast.succes('Section modifiée', { detail: `${code} — ${name}` });
          }}
        />
      )}
    </div>
  );
}
