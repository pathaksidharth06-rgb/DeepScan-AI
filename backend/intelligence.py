"""
DeepScan AI - Rule-based Sonar Intelligence Engine
Implements the 11-class Side-Scan Sonar (SSS) decision-support heuristics
"""

TAXONOMY_RULES = {
    "Shipwreck": {
        "category": "Marine Debris / Anthropogenic",
        "base_eco_weight": 35,
        "eco_impact": "Potential Hazard",
        "action_recommended": "Review detection and assess site",
        "default_priority": "MEDIUM",
    },
    "Fishing Net": {
        "category": "Marine Debris / Anthropogenic",
        "base_eco_weight": 45,
        "eco_impact": "High Threat - Ghost Gear",
        "action_recommended": "Prioritize inspection and removal",
        "default_priority": "HIGH",
    },
    "Crab Pot": {
        "category": "Marine Debris / Anthropogenic",
        "base_eco_weight": 30,
        "eco_impact": "Derelict Trap / Ghost Fishing",
        "action_recommended": "Schedule retrieval and verify tag",
        "default_priority": "MEDIUM",
    },
    "Pipe": {
        "category": "Marine Debris / Anthropogenic",
        "base_eco_weight": 25,
        "eco_impact": "Subsea Infrastructure Hazard",
        "action_recommended": "Cross-reference nautical charts & pipeline registry",
        "default_priority": "MEDIUM",
    },
    "Rope": {
        "category": "Marine Debris / Anthropogenic",
        "base_eco_weight": 20,
        "eco_impact": "Entanglement Risk for Marine Fauna",
        "action_recommended": "Mark for clearance during maintenance survey",
        "default_priority": "LOW",
    },
    "Tire": {
        "category": "Marine Debris / Anthropogenic",
        "base_eco_weight": 15,
        "eco_impact": "Persistent Microplastic / Synthetic Waste",
        "action_recommended": "Log for routine seabed cleanup operation",
        "default_priority": "LOW",
    },
    "Weight": {
        "category": "Marine Debris / Anthropogenic",
        "base_eco_weight": 15,
        "eco_impact": "Heavy Anthropogenic Debris",
        "action_recommended": "Catalog seabed obstruction position",
        "default_priority": "LOW",
    },
    "Block": {
        "category": "Marine Debris / Anthropogenic",
        "base_eco_weight": 20,
        "eco_impact": "Concrete / Construction Anomaly",
        "action_recommended": "Update high-resolution bathymetric chart",
        "default_priority": "LOW",
    },
    "Artificial Reef": {
        "category": "Marine Debris / Anthropogenic",
        "base_eco_weight": 10,
        "eco_impact": "Beneficial Artificial Habitat",
        "action_recommended": "Monitor benthic ecosystem colonization",
        "default_priority": "LOW",
    },
    "Pipeline/Cylinder": {
        "category": "Marine Debris / Anthropogenic",
        "base_eco_weight": 35,
        "eco_impact": "Critical Subsea Utility Corridor",
        "action_recommended": "Assess sediment burial & cathodic integrity",
        "default_priority": "HIGH",
    },
    "Boulder": {
        "category": "Natural Object",
        "base_eco_weight": 5,
        "eco_impact": "Benign Natural Geological Feature",
        "action_recommended": "Log natural acoustic backscatter feature",
        "default_priority": "LOW",
    },
    "Unknown Anomaly": {
        "category": "Unknown Anomaly",
        "base_eco_weight": 40,
        "eco_impact": "Unidentified Acoustic Signature (OOD)",
        "action_recommended": "Deploy targeted ROV video verification",
        "default_priority": "HIGH",
    },
}


def get_intelligence(class_name: str, confidence: float, bbox: list) -> dict:
    """
    Enriches raw YOLO detection with ecological priority scoring and actions.
    """
    rule = TAXONOMY_RULES.get(class_name, TAXONOMY_RULES["Unknown Anomaly"])
    
    x1, y1, x2, y2 = bbox
    width = round(abs(x2 - x1), 2)
    height = round(abs(y2 - y1), 2)
    size_pixels = width * height
    
    # Calculate Heuristic Priority Score (0-100)
    size_factor = min(20, round((size_pixels / 50000) * 20))
    conf_factor = round(confidence * 35)
    base_weight = rule["base_eco_weight"]
    
    raw_score = base_weight + conf_factor + size_factor
    priority_score = min(100, max(5, raw_score))
    
    if priority_score >= 75:
        priority_level = "HIGH"
    elif priority_score >= 45:
        priority_level = "MEDIUM"
    else:
        priority_level = "LOW"
        
    return {
        "category": rule["category"],
        "eco_impact": rule["eco_impact"],
        "priority_score": priority_score,
        "priority_level": priority_level,
        "action_recommended": rule["action_recommended"],
        "pixel_dimensions": {
            "width": width,
            "height": height
        }
    }
