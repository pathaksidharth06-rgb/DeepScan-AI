export type SonarClass =
  | 'Shipwreck'
  | 'Fishing Net'
  | 'Crab Pot'
  | 'Pipe'
  | 'Rope'
  | 'Tire'
  | 'Weight'
  | 'Block'
  | 'Artificial Reef'
  | 'Pipeline/Cylinder'
  | 'Boulder'
  | 'Unknown Anomaly';

export type ObjectCategory = 'Marine Debris / Anthropogenic' | 'Natural Object' | 'Unknown Anomaly';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type SpeckleLevel = 'LOW' | 'MODERATE' | 'SEVERE';
export type QualityRating = 'OPTIMAL' | 'ACCEPTABLE' | 'POOR';
export type ShadowEvidenceStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'ABSENT';
export type ArtifactSeverity = 'NONE' | 'LOW' | 'MODERATE' | 'SEVERE';
export type ReliabilityLevel = 'HIGH' | 'MEDIUM' | 'REVIEW';

export interface SpeckleNoiseMetrics {
  speckleIndex: number;
  speckleLevel: SpeckleLevel;
  enl: number;
  score: number;
  description: string;
}

export interface ResolutionQualityMetrics {
  width: number;
  height: number;
  sharpnessScore: number;
  laplacianVariance: number;
  meanGradient: number;
  contrastScore: number;
  dynamicRange: number;
  qualityRating: QualityRating;
  compositeScore: number;
  description: string;
  disclaimer: string;
}

export interface MotionDropoutMetrics {
  dropoutDetected: boolean;
  dropoutCount: number;
  dropoutPercentage: number;
  artifactSeverity: ArtifactSeverity;
  rowJitterMean: number;
  detectedArtifacts: string[];
  description: string;
  disclaimer: string;
}

export interface AcousticShadowMetrics {
  shadowDetected: boolean;
  shadowContrastRatio: number;
  evidenceStrength: ShadowEvidenceStrength;
  description: string;
  methodology?: string;
}

export interface AIEvidenceAssessment {
  evidenceScore: number; // 0-100
  reliability: ReliabilityLevel;
  reviewRequired: boolean;
  reviewReasons: string[];
  components?: {
    yolo_confidence_contribution?: number;
    shadow_evidence_contribution?: number;
    quality_contribution?: number;
    noise_penalty?: number;
    artifact_penalty?: number;
  };
}

export interface SonarQualityAnalysis {
  speckleNoise: SpeckleNoiseMetrics;
  resolutionQuality: ResolutionQualityMetrics;
  motionDropout: MotionDropoutMetrics;
  acousticShadow: AcousticShadowMetrics;
}

export interface SonarDetection {
  id: string;
  className: SonarClass;
  category: ObjectCategory;
  confidence: number; // 0.0 to 1.0
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  pixelDimensions: {
    width: number;
    height: number;
  };
  priorityScore: number; // 0-100
  priorityLevel: PriorityLevel;
  ecoImpact: string;
  actionRecommended: string;
  verificationStatus: 'unreviewed' | 'verified' | 'rejected';
  correctedLabel?: SonarClass;
  notes?: string;
  timestamp: string;
  shadowMetrics?: AcousticShadowMetrics;
  evidenceScore?: number;
  reliability?: ReliabilityLevel;
  reviewRequired?: boolean;
  reviewReasons?: string[];
}

export interface SonarScan {
  id: string;
  filename: string;
  fileSizeMB: number;
  resolution: {
    width: number;
    height: number;
  };
  imageUrl: string;
  annotatedImageUrl?: string;
  detections: SonarDetection[];
  processedAt: string;
  processingTimeMs: number;
  modelVersion: string;
  isSample?: boolean;
  sonarQuality?: SonarQualityAnalysis;
  evidenceAssessment?: AIEvidenceAssessment;
}

export interface MissionBatch {
  id: string;
  missionName: string;
  date: string;
  totalImages: number;
  totalDetections: number;
  highPriorityCount: number;
  scans: SonarScan[];
  status: 'completed' | 'processing' | 'idle';
}

export interface IntelligenceRule {
  category: ObjectCategory;
  baseEcoWeight: number; // 0 - 50
  ecoImpact: string;
  actionRecommended: string;
  defaultPriorityLevel: PriorityLevel;
}
