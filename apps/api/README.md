# @dnpec/api

Backend API du SI DNPEC — **Node.js + NestJS (TypeScript)**, **PostgreSQL + Prisma**
(cahier des charges §7.7).

Modules métier prévus (un module Nest par domaine, cf.
`docs/architecture-proposition.md` §2) :
`auth`, `users`, `org` (divisions/sections), `tasks`, `communication`, `documents`
(GED), `leaves` (congés), `directory`, `meetings`, `polls`, `suggestions`,
`notifications`, `audit`, `search`.

Ce dossier est un scaffold vide pour l'instant : ni le projet NestJS (`nest new`)
ni le schéma Prisma ne sont encore initialisés.

Le schéma de base de données (`prisma/schema.prisma`) est en cours de conception —
voir la proposition soumise pour validation avant toute migration.
