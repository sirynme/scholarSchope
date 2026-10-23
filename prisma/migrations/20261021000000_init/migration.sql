-- ScholarScope Initial PostgreSQL Migration (20261021000000_init)
-- Normalized multi-user graduate admissions & scholarship intelligence schema

CREATE TYPE "VerificationStatus" AS ENUM (
  'OFFICIALLY_CONFIRMED',
  'CROSS_VERIFIED',
  'OFFICIAL_SOURCE_NOT_FULLY_VERIFIED',
  'CONFLICTING_EVIDENCE',
  'STALE',
  'UNVERIFIED',
  'UNAVAILABLE'
);

CREATE TYPE "FundingClassification" AS ENUM (
  'FULLY_FUNDED_CONFIRMED',
  'TUITION_FUNDED_LIVING_COSTS_COVERED',
  'TUITION_FUNDED_LIVING_COSTS_UNCERTAIN',
  'PARTIALLY_FUNDED',
  'TUITION_ONLY',
  'STIPEND_ONLY',
  'CONDITIONAL_FUNDING',
  'SELF_FUNDED',
  'FUNDING_UNVERIFIED'
);

CREATE TYPE "EligibilityStatus" AS ENUM (
  'LIKELY_ELIGIBLE',
  'POTENTIALLY_ELIGIBLE',
  'NOT_ELIGIBLE',
  'INSUFFICIENT_INFORMATION',
  'NEEDS_VERIFICATION'
);

CREATE TYPE "AutomationState" AS ENUM (
  'ACTIVE',
  'DEGRADED',
  'PAUSED',
  'FAILED'
);

CREATE TYPE "ApplicationStatus" AS ENUM (
  'RESEARCHING',
  'PREPARING_DOCUMENTS',
  'READY_TO_APPLY',
  'SUBMITTED',
  'INTERVIEW',
  'OFFER_RECEIVED',
  'ACCEPTED',
  'REJECTED'
);

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'student',
  "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "UserProfile" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "citizenship" TEXT,
  "residencyCountry" TEXT,
  "currentDegree" TEXT,
  "currentUniversity" TEXT,
  "gpaValue" DOUBLE PRECISION,
  "gradingScale" TEXT,
  "gradingClassification" TEXT,
  "graduationDate" TEXT,
  "completedPrerequisites" TEXT[],
  "englishTestType" TEXT,
  "englishTestScore" DOUBLE PRECISION,
  "greVerbal" INTEGER,
  "greQuant" INTEGER,
  "greWriting" DOUBLE PRECISION,
  "researchMonths" INTEGER NOT NULL DEFAULT 0,
  "publicationsCount" INTEGER NOT NULL DEFAULT 0,
  "workExperienceMonths" INTEGER NOT NULL DEFAULT 0,
  "technicalSkills" TEXT[],
  "applicationBudgetUsd" DOUBLE PRECISION,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

CREATE TABLE "Institution" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT,
  "campus" TEXT,
  "officialDomain" TEXT NOT NULL,
  "officialWebsiteUrl" TEXT NOT NULL,
  "authorityTier" TEXT NOT NULL DEFAULT 'UNIVERSITY',
  "lastVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Institution_officialDomain_key" ON "Institution"("officialDomain");

CREATE TABLE "Program" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "institutionId" UUID NOT NULL,
  "departmentId" UUID,
  "title" TEXT NOT NULL,
  "degreeLevel" TEXT NOT NULL,
  "discipline" TEXT NOT NULL,
  "durationMonths" INTEGER,
  "intakeTerm" TEXT,
  "applicationCycle" TEXT,
  "officialProgramUrl" TEXT NOT NULL,
  "officialApplicationUrl" TEXT,
  "applicationFeeAmount" DOUBLE PRECISION,
  "applicationFeeCurrency" TEXT,
  "supervisorContactReq" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isExpired" BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "fundingClassification" "FundingClassification" NOT NULL DEFAULT 'FUNDING_UNVERIFIED',
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Program_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Program_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Program_officialProgramUrl_key" ON "Program"("officialProgramUrl");

CREATE TABLE "Scholarship" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "awardingOrganization" TEXT NOT NULL,
  "authorityType" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "officialUrl" TEXT NOT NULL,
  "eligibleDegrees" TEXT[],
  "eligibleCountries" TEXT[],
  "excludedCitizenships" TEXT[],
  "eligibleFields" TEXT[],
  "deadlineDate" TIMESTAMP(3),
  "applicationCycle" TEXT,
  "separateApplicationReq" BOOLEAN NOT NULL DEFAULT false,
  "fundingClassification" "FundingClassification" NOT NULL DEFAULT 'FUNDING_UNVERIFIED',
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "lastCheckedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Scholarship_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Scholarship_officialUrl_key" ON "Scholarship"("officialUrl");

CREATE TABLE "EvidenceClaim" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "programId" UUID,
  "scholarshipId" UUID,
  "claimType" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "supportingExcerpt" TEXT NOT NULL,
  "excerptHash" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceDomain" TEXT NOT NULL,
  "sourceOrganization" TEXT NOT NULL,
  "pageSection" TEXT,
  "retrievedAt" TIMESTAMP(3) NOT NULL,
  "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastContentChangeAt" TIMESTAMP(3),
  "verificationMethod" TEXT NOT NULL,
  "verificationStatus" "VerificationStatus" NOT NULL,
  "evidenceQualityScore" DOUBLE PRECISION NOT NULL,
  "applicationCycle" TEXT,
  "freshnessPolicy" TEXT NOT NULL DEFAULT 'WEEKLY',
  "conflictingClaimIds" TEXT[],
  CONSTRAINT "EvidenceClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobQueueItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "idempotencyKey" TEXT NOT NULL,
  "jobType" TEXT NOT NULL,
  "targetDomain" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 50,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "leaseOwner" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "executionLog" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobQueueItem_idempotencyKey_key" ON "JobQueueItem"("idempotencyKey");
