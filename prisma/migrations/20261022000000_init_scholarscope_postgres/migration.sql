-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'student',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedSessionToken" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedSessionToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "citizenship" TEXT,
    "residencyCountry" TEXT,
    "ageYears" INTEGER,
    "hecEquivalenceConfirmed" BOOLEAN NOT NULL DEFAULT false,
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
    "targetDegrees" TEXT[],
    "targetFields" TEXT[],
    "fundingPreferenceMode" TEXT,
    "preferredCountries" TEXT[],
    "preferredUniversities" TEXT[],
    "requireFullFunding" BOOLEAN NOT NULL DEFAULT false,
    "minAnnualLivingSupportUsd" DOUBLE PRECISION,
    "preferredIntakes" TEXT[],
    "applicationCycles" TEXT[],
    "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysBeforeDeadline" INTEGER[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQualification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "completedDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserQualification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "campus" TEXT,
    "officialDomain" TEXT NOT NULL,
    "officialWebsiteUrl" TEXT NOT NULL,
    "authorityTier" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "researchAreas" TEXT[],
    "websiteUrl" TEXT,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "departmentId" TEXT,
    "title" TEXT NOT NULL,
    "degreeLevel" TEXT NOT NULL,
    "discipline" TEXT NOT NULL,
    "broadField" TEXT,
    "specializations" TEXT[],
    "opportunityType" TEXT,
    "globalRegion" TEXT,
    "durationMonths" INTEGER,
    "intakeTerm" TEXT,
    "applicationCycle" TEXT,
    "officialProgramUrl" TEXT NOT NULL,
    "officialApplicationUrl" TEXT,
    "contactEmail" TEXT,
    "applicationStages" TEXT[],
    "applicationFeeAmount" DOUBLE PRECISION,
    "applicationFeeCurrency" TEXT,
    "supervisorContactReq" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "deadlineDate" TIMESTAMP(3),
    "deadlineTimezone" TEXT,
    "openingDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" TEXT NOT NULL DEFAULT 'Unverified',
    "fundingClassification" TEXT NOT NULL DEFAULT 'Funding Unverified',
    "scholarshipIds" TEXT[],
    "claimIds" TEXT[],
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionRequirement" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "minGpa" DOUBLE PRECISION,
    "gradingScale" TEXT,
    "minGradingClassification" TEXT,
    "acceptedBackgrounds" TEXT[],
    "prerequisiteCourses" TEXT[],
    "ieltsMinScore" DOUBLE PRECISION,
    "toeflMinScore" DOUBLE PRECISION,
    "greRequirement" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "citizenshipRule" TEXT,
    "excludedCitizenships" TEXT[],
    "maxAgeLimit" INTEGER,
    "residencyRule" TEXT,
    "workExperienceReq" TEXT,
    "feeWaiverAvailable" BOOLEAN,
    "researchExpRequired" BOOLEAN NOT NULL DEFAULT false,
    "requiredDocuments" TEXT[],
    "verificationStatus" TEXT NOT NULL DEFAULT 'Unverified',
    "supportingClaimIds" TEXT[],

    CONSTRAINT "AdmissionRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scholarship" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "awardingOrganization" TEXT NOT NULL,
    "authorityType" TEXT NOT NULL,
    "opportunityType" TEXT,
    "country" TEXT NOT NULL,
    "officialUrl" TEXT NOT NULL,
    "eligibleDegrees" TEXT[],
    "eligibleCountries" TEXT[],
    "excludedCitizenships" TEXT[],
    "eligibleFields" TEXT[],
    "deadlineDate" TIMESTAMP(3),
    "deadlineTimezone" TEXT,
    "applicationCycle" TEXT,
    "separateApplicationReq" BOOLEAN NOT NULL DEFAULT true,
    "nominationProcessNote" TEXT,
    "fundingClassification" TEXT NOT NULL DEFAULT 'Funding Unverified',
    "verificationStatus" TEXT NOT NULL DEFAULT 'Unverified',
    "claimIds" TEXT[],
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingPackage" (
    "id" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "tuitionCoveragePercent" DOUBLE PRECISION,
    "mandatoryFeesCovered" BOOLEAN,
    "stipendAmountAnnual" DOUBLE PRECISION,
    "stipendCurrency" TEXT,
    "stipendAmountUsdApprox" DOUBLE PRECISION,
    "stipendFrequency" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "durationMonths" INTEGER,
    "accommodationCovered" BOOLEAN,
    "healthInsuranceCovered" BOOLEAN,
    "travelAllowanceCovered" BOOLEAN,
    "relocationSupportCovered" BOOLEAN,
    "renewalConditions" TEXT,
    "awardBasis" TEXT NOT NULL DEFAULT 'COMPETITIVE',
    "livingCostBenchmarkAnnual" DOUBLE PRECISION,
    "livingCostBenchmarkCurr" TEXT,
    "livingCostBenchmarkSource" TEXT,
    "livingCostBenchmarkDate" TEXT,
    "livingCostSurplusOrDeficit" DOUBLE PRECISION,
    "livingCostAdequacyStatus" TEXT NOT NULL DEFAULT 'UNCERTAIN',
    "classification" TEXT NOT NULL DEFAULT 'Funding Unverified',
    "classificationExplanation" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramScholarship" (
    "programId" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,

    CONSTRAINT "ProgramScholarship_pkey" PRIMARY KEY ("programId","scholarshipId")
);

-- CreateTable
CREATE TABLE "EvidenceClaim" (
    "id" TEXT NOT NULL,
    "programId" TEXT,
    "scholarshipId" TEXT,
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
    "verificationStatus" TEXT NOT NULL DEFAULT 'Unverified',
    "evidenceQualityScore" INTEGER NOT NULL DEFAULT 0,
    "applicationCycle" TEXT,
    "freshnessPolicy" TEXT NOT NULL DEFAULT 'WEEKLY',
    "conflictingClaimIds" TEXT[],

    CONSTRAINT "EvidenceClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimVersion" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,
    "supportingExcerpt" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "admissionStatus" TEXT NOT NULL,
    "scholarshipStatus" TEXT NOT NULL,
    "fundingCompletenessStatus" TEXT NOT NULL,
    "pakistaniEligibilityStatus" TEXT,
    "overallRankScore" DOUBLE PRECISION NOT NULL,
    "decisionsJson" TEXT NOT NULL,
    "rankingFactorsJson" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRegistry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "seedUrl" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "authorityLevel" TEXT NOT NULL DEFAULT 'PRIMARY_OFFICIAL',
    "refreshPolicy" TEXT NOT NULL DEFAULT 'DAILY',
    "priority" TEXT DEFAULT 'NORMAL',
    "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 10,
    "maxConcurrency" INTEGER NOT NULL DEFAULT 2,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "robotsTxtAllowed" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "lastHttpStatus" INTEGER,
    "lastResponseTimeMs" INTEGER,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "isolatedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FetchAttempt" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "httpStatus" INTEGER,
    "responseTimeMs" INTEGER NOT NULL,
    "contentType" TEXT,
    "bytesReceived" INTEGER,
    "etag" TEXT,
    "lastModifiedHdr" TEXT,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FetchAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceSnapshot" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "title" TEXT,
    "extractedTextSnippet" TEXT NOT NULL,
    "discoveredChildLinks" TEXT[],
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobQueueItem" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "targetDomain" TEXT NOT NULL,
    "sourceId" TEXT,
    "url" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,
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

-- CreateTable
CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourcesChecked" INTEGER NOT NULL DEFAULT 0,
    "urlsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "httpSuccessCount" INTEGER NOT NULL DEFAULT 0,
    "httpFailureCount" INTEGER NOT NULL DEFAULT 0,
    "claimsExtracted" INTEGER NOT NULL DEFAULT 0,
    "changesDetected" INTEGER NOT NULL DEFAULT 0,
    "notificationsCreated" INTEGER NOT NULL DEFAULT 0,
    "summaryLog" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeEvent" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityTitle" TEXT NOT NULL,
    "fieldChanged" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "isGenuineChange" BOOLEAN NOT NULL DEFAULT true,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedOpportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "applicationStatus" TEXT NOT NULL DEFAULT 'Researching',
    "privateNotes" TEXT NOT NULL DEFAULT '',
    "priorityLevel" TEXT NOT NULL DEFAULT 'HIGH',
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "syncedFromEvidence" BOOLEAN NOT NULL DEFAULT false,
    "userNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChecklistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT,
    "documentName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'MISSING',
    "sourceRequirement" TEXT,
    "userNotes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "isUncertainDate" BOOLEAN NOT NULL DEFAULT false,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notificationId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RESEND',
    "status" TEXT NOT NULL,
    "providerMsgId" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemHealth" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "automationState" TEXT NOT NULL DEFAULT 'Active',
    "stateReason" TEXT NOT NULL DEFAULT 'Scheduled runs healthy',
    "cronSchedule" TEXT NOT NULL DEFAULT '0 2 * * *',
    "lastScheduledRunAt" TIMESTAMP(3),
    "lastSuccessfulRunAt" TIMESTAMP(3),
    "missedRunsCount" INTEGER NOT NULL DEFAULT 0,
    "totalRequestsMade" INTEGER NOT NULL DEFAULT 0,
    "totalBytesFetched" BIGINT NOT NULL DEFAULT 0,
    "searchProviderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiProviderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailProviderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemHealth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "RevokedSessionToken_userId_idx" ON "RevokedSessionToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserQualification_userId_idx" ON "UserQualification"("userId");

-- CreateIndex
CREATE INDEX "Institution_country_idx" ON "Institution"("country");

-- CreateIndex
CREATE INDEX "Institution_officialDomain_idx" ON "Institution"("officialDomain");

-- CreateIndex
CREATE INDEX "Department_institutionId_idx" ON "Department"("institutionId");

-- CreateIndex
CREATE INDEX "Program_institutionId_idx" ON "Program"("institutionId");

-- CreateIndex
CREATE INDEX "Program_degreeLevel_discipline_idx" ON "Program"("degreeLevel", "discipline");

-- CreateIndex
CREATE INDEX "Program_verificationStatus_fundingClassification_idx" ON "Program"("verificationStatus", "fundingClassification");

-- CreateIndex
CREATE INDEX "Program_officialProgramUrl_idx" ON "Program"("officialProgramUrl");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionRequirement_programId_key" ON "AdmissionRequirement"("programId");

-- CreateIndex
CREATE INDEX "Scholarship_country_fundingClassification_idx" ON "Scholarship"("country", "fundingClassification");

-- CreateIndex
CREATE INDEX "Scholarship_officialUrl_idx" ON "Scholarship"("officialUrl");

-- CreateIndex
CREATE UNIQUE INDEX "FundingPackage_scholarshipId_key" ON "FundingPackage"("scholarshipId");

-- CreateIndex
CREATE INDEX "EvidenceClaim_programId_claimType_idx" ON "EvidenceClaim"("programId", "claimType");

-- CreateIndex
CREATE INDEX "EvidenceClaim_scholarshipId_claimType_idx" ON "EvidenceClaim"("scholarshipId", "claimType");

-- CreateIndex
CREATE INDEX "EvidenceClaim_sourceDomain_idx" ON "EvidenceClaim"("sourceDomain");

-- CreateIndex
CREATE INDEX "ClaimVersion_claimId_idx" ON "ClaimVersion"("claimId");

-- CreateIndex
CREATE INDEX "EligibilityResult_userId_overallRankScore_idx" ON "EligibilityResult"("userId", "overallRankScore");

-- CreateIndex
CREATE UNIQUE INDEX "EligibilityResult_userId_programId_key" ON "EligibilityResult"("userId", "programId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceRegistry_seedUrl_key" ON "SourceRegistry"("seedUrl");

-- CreateIndex
CREATE INDEX "SourceRegistry_domain_idx" ON "SourceRegistry"("domain");

-- CreateIndex
CREATE INDEX "SourceRegistry_country_idx" ON "SourceRegistry"("country");

-- CreateIndex
CREATE INDEX "FetchAttempt_sourceId_attemptedAt_idx" ON "FetchAttempt"("sourceId", "attemptedAt");

-- CreateIndex
CREATE INDEX "FetchAttempt_normalizedUrl_idx" ON "FetchAttempt"("normalizedUrl");

-- CreateIndex
CREATE INDEX "SourceSnapshot_sourceId_normalizedUrl_idx" ON "SourceSnapshot"("sourceId", "normalizedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "JobQueueItem_idempotencyKey_key" ON "JobQueueItem"("idempotencyKey");

-- CreateIndex
CREATE INDEX "JobQueueItem_status_nextRunAt_priority_idx" ON "JobQueueItem"("status", "nextRunAt", "priority");

-- CreateIndex
CREATE INDEX "JobQueueItem_targetDomain_status_idx" ON "JobQueueItem"("targetDomain", "status");

-- CreateIndex
CREATE INDEX "ChangeEvent_entityId_detectedAt_idx" ON "ChangeEvent"("entityId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedOpportunity_userId_programId_key" ON "SavedOpportunity"("userId", "programId");

-- CreateIndex
CREATE INDEX "ApplicationTask_userId_dueDate_idx" ON "ApplicationTask"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "DocumentChecklistItem_userId_idx" ON "DocumentChecklistItem"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "EmailDelivery_userId_idx" ON "EmailDelivery"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQualification" ADD CONSTRAINT "UserQualification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionRequirement" ADD CONSTRAINT "AdmissionRequirement_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingPackage" ADD CONSTRAINT "FundingPackage_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramScholarship" ADD CONSTRAINT "ProgramScholarship_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramScholarship" ADD CONSTRAINT "ProgramScholarship_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceClaim" ADD CONSTRAINT "EvidenceClaim_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceClaim" ADD CONSTRAINT "EvidenceClaim_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimVersion" ADD CONSTRAINT "ClaimVersion_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "EvidenceClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityResult" ADD CONSTRAINT "EligibilityResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityResult" ADD CONSTRAINT "EligibilityResult_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FetchAttempt" ADD CONSTRAINT "FetchAttempt_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSnapshot" ADD CONSTRAINT "SourceSnapshot_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "SourceRegistry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationTask" ADD CONSTRAINT "ApplicationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationTask" ADD CONSTRAINT "ApplicationTask_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChecklistItem" ADD CONSTRAINT "DocumentChecklistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

