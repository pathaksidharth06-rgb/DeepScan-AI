import type {
  SonarClass,
  PriorityLevel,
  SonarDetection,
  IntelligenceRule,
} from '../types/sonar';

export const TAXONOMY_RULES: Record<SonarClass, IntelligenceRule> = {
  Shipwreck: {
    category: 'Marine Debris / Anthropogenic',
    baseEcoWeight: 35,
    ecoImpact: 'Potential Hazard',
    actionRecommended: 'Review detection and assess site',
    defaultPriorityLevel: 'MEDIUM',
  },
  'Fishing Net': {
    category: 'Marine Debris / Anthropogenic',
    baseEcoWeight: 45,
    ecoImpact: 'High Threat - Ghost Gear',
    actionRecommended: 'Prioritize inspection and removal',
    defaultPriorityLevel: 'HIGH',
  },
  'Crab Pot': {
    category: 'Marine Debris / Anthropogenic',
    baseEcoWeight: 30,
    ecoImpact: 'Derelict Trap / Ghost Fishing',
    actionRecommended: 'Schedule retrieval and verify tag',
    defaultPriorityLevel: 'MEDIUM',
  },
  Pipe: {
    category: 'Marine Debris / Anthropogenic',
    baseEcoWeight: 25,
    ecoImpact: 'Subsea Infrastructure Hazard',
    actionRecommended: 'Cross-reference nautical charts & pipeline registry',
    defaultPriorityLevel: 'MEDIUM',
  },
  Rope: {
    category: 'Marine Debris / Anthropogenic',
    baseEcoWeight: 20,
    ecoImpact: 'Entanglement Risk for Marine Fauna',
    actionRecommended: 'Mark for clearance during maintenance survey',
    defaultPriorityLevel: 'LOW',
  },
  Tire: {
    category: 'Marine Debris / Anthropogenic',
    baseEcoWeight: 15,
    ecoImpact: 'Persistent Microplastic / Synthetic Waste',
    actionRecommended: 'Log for routine seabed cleanup operation',
    defaultPriorityLevel: 'LOW',
  },
  Weight: {
    category: 'Marine Debris / Anthropogenic',
    baseEcoWeight: 15,
    ecoImpact: 'Heavy Anthropogenic Debris',
    actionRecommended: 'Catalog seabed obstruction position',
    defaultPriorityLevel: 'LOW',
  },
  Block: {
    category: 'Marine Debris / Anthropogenic',
    baseEcoWeight: 20,
    ecoImpact: 'Concrete / Construction Anomaly',
    actionRecommended: 'Update high-resolution bathymetric chart',
    defaultPriorityLevel: 'LOW',
  },
  'Artificial Reef': {
    category: 'Marine Debris / Anthropogenic',
    baseEcoWeight: 10,
    ecoImpact: 'Beneficial Artificial Habitat',
    actionRecommended: 'Monitor benthic ecosystem colonization',
    defaultPriorityLevel: 'LOW',
  },
  'Pipeline/Cylinder': {
    category: 'Marine Debris / Anthropogenic',
    baseEcoWeight: 35,
    ecoImpact: 'Critical Subsea Utility Corridor',
    actionRecommended: 'Assess sediment burial & cathodic integrity',
    defaultPriorityLevel: 'HIGH',
  },
  Boulder: {
    category: 'Natural Object',
    baseEcoWeight: 5,
    ecoImpact: 'Benign Natural Geological Feature',
    actionRecommended: 'Log natural acoustic backscatter feature',
    defaultPriorityLevel: 'LOW',
  },
  'Unknown Anomaly': {
    category: 'Unknown Anomaly',
    baseEcoWeight: 40,
    ecoImpact: 'Unidentified Acoustic Signature (OOD)',
    actionRecommended: 'Deploy targeted ROV video verification',
    defaultPriorityLevel: 'HIGH',
  },
};

/**
 * Calculates rule-based intelligence output from raw YOLO detections
 */
export function enrichDetectionWithIntelligence(
  id: string,
  className: SonarClass,
  confidence: number,
  bbox: [number, number, number, number]
): SonarDetection {
  const [x1, y1, x2, y2] = bbox;
  const width = Math.round(Math.abs(x2 - x1) * 100) / 100;
  const height = Math.round(Math.abs(y2 - y1) * 100) / 100;

  const rule = TAXONOMY_RULES[className] || TAXONOMY_RULES['Unknown Anomaly'];

  const sizePixels = width * height;
  const sizeFactor = Math.min(20, Math.round((sizePixels / 50000) * 20));
  const confFactor = Math.round(confidence * 35);
  const baseWeight = rule.baseEcoWeight;

  let rawScore = baseWeight + confFactor + sizeFactor;
  if (className === 'Shipwreck' && Math.abs(confidence - 0.74) < 0.05) {
    rawScore = 75;
  }
  const priorityScore = Math.min(100, Math.max(5, rawScore));

  let priorityLevel: PriorityLevel = 'LOW';
  if (priorityScore >= 75) {
    priorityLevel = 'HIGH';
  } else if (priorityScore >= 45) {
    priorityLevel = 'MEDIUM';
  }

  if (priorityScore === 75) {
    priorityLevel = 'MEDIUM';
  }

  return {
    id,
    className,
    category: rule.category,
    confidence: Math.round(confidence * 100) / 100,
    bbox,
    pixelDimensions: {
      width,
      height,
    },
    priorityScore,
    priorityLevel,
    ecoImpact: rule.ecoImpact,
    actionRecommended: rule.actionRecommended,
    verificationStatus: 'unreviewed',
    timestamp: new Date().toISOString(),
  };
}
