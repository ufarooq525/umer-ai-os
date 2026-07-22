export const packageName = '@umer/artifacts' as const;

export type ValidationIssueCode =
  | 'MALFORMED'
  | 'MISSING_CRITERION'
  | 'UNVERIFIED_CRITERION'
  | 'INVENTED_CRITERION';

export type ValidationIssue = {
  code: ValidationIssueCode;
  message: string;
};

export type ValidationContext = {
  /** Criteria fixed in the originating Task/Brief before work started. */
  requiredCriteria: string[];
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export type SealRecord = {
  artifactId: string;
  sealedAt: string;
  contentHash: string;
  acceptanceStatus: 'submitted' | 'accepted';
};

export type TransferPackage = {
  transferId: string;
  execId: string;
  fromProducer: string;
  toConsumer: string;
  artifactIds: string[];
  createdAt: string;
};

export type TransferReceipt = {
  transferId: string;
  status: 'delivered' | 'rejected';
  artifactIds: string[];
  receivedAt: string;
  reason?: string;
};

export type SupersedeResult = {
  previousArtifactId: string;
  nextArtifactId: string;
  lineageRootId: string;
};
