-- CreateTable
CREATE TABLE "SmartContract" (
    "id" SERIAL NOT NULL,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "name" TEXT,
    "abi" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vulnerability" (
    "id" SERIAL NOT NULL,
    "cve" TEXT,
    "swcId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reportedAt" TIMESTAMP(3),
    "smartContractId" INTEGER NOT NULL,

    CONSTRAINT "Vulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BountyProgram" (
    "id" SERIAL NOT NULL,
    "platform" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "maxPayout" DOUBLE PRECISION NOT NULL,
    "scope" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BountyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payout" DOUBLE PRECISION,
    "payoutToken" TEXT,
    "payoutTxHash" TEXT,
    "reporter" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "bountyProgramId" INTEGER NOT NULL,
    "smartContractId" INTEGER NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anomaly" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "transactionHash" TEXT NOT NULL,
    "logIndex" INTEGER,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "smartContractId" INTEGER NOT NULL,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BountyProgramToSmartContract" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_BountyProgramToSmartContract_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "SmartContract_chain_idx" ON "SmartContract"("chain");

-- CreateIndex
CREATE UNIQUE INDEX "SmartContract_address_chain_key" ON "SmartContract"("address", "chain");

-- CreateIndex
CREATE INDEX "Vulnerability_smartContractId_idx" ON "Vulnerability"("smartContractId");

-- CreateIndex
CREATE INDEX "Vulnerability_severity_idx" ON "Vulnerability"("severity");

-- CreateIndex
CREATE INDEX "Vulnerability_swcId_idx" ON "Vulnerability"("swcId");

-- CreateIndex
CREATE INDEX "BountyProgram_platform_idx" ON "BountyProgram"("platform");

-- CreateIndex
CREATE INDEX "BountyProgram_status_idx" ON "BountyProgram"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BountyProgram_platform_protocol_key" ON "BountyProgram"("platform", "protocol");

-- CreateIndex
CREATE INDEX "Opportunity_bountyProgramId_idx" ON "Opportunity"("bountyProgramId");

-- CreateIndex
CREATE INDEX "Opportunity_smartContractId_idx" ON "Opportunity"("smartContractId");

-- CreateIndex
CREATE INDEX "Opportunity_severity_idx" ON "Opportunity"("severity");

-- CreateIndex
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Anomaly_transactionHash_key" ON "Anomaly"("transactionHash");

-- CreateIndex
CREATE INDEX "Anomaly_smartContractId_idx" ON "Anomaly"("smartContractId");

-- CreateIndex
CREATE INDEX "Anomaly_type_idx" ON "Anomaly"("type");

-- CreateIndex
CREATE INDEX "Anomaly_severity_idx" ON "Anomaly"("severity");

-- CreateIndex
CREATE INDEX "Anomaly_detectedAt_idx" ON "Anomaly"("detectedAt");

-- CreateIndex
CREATE INDEX "Anomaly_blockNumber_idx" ON "Anomaly"("blockNumber");

-- CreateIndex
CREATE INDEX "_BountyProgramToSmartContract_B_index" ON "_BountyProgramToSmartContract"("B");

-- AddForeignKey
ALTER TABLE "Vulnerability" ADD CONSTRAINT "Vulnerability_smartContractId_fkey" FOREIGN KEY ("smartContractId") REFERENCES "SmartContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_bountyProgramId_fkey" FOREIGN KEY ("bountyProgramId") REFERENCES "BountyProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_smartContractId_fkey" FOREIGN KEY ("smartContractId") REFERENCES "SmartContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anomaly" ADD CONSTRAINT "Anomaly_smartContractId_fkey" FOREIGN KEY ("smartContractId") REFERENCES "SmartContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BountyProgramToSmartContract" ADD CONSTRAINT "_BountyProgramToSmartContract_A_fkey" FOREIGN KEY ("A") REFERENCES "BountyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BountyProgramToSmartContract" ADD CONSTRAINT "_BountyProgramToSmartContract_B_fkey" FOREIGN KEY ("B") REFERENCES "SmartContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
