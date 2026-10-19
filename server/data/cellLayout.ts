// Zone name of each of the 100 mat cells in a 10x10 matrix (row-major, cell number = index + 1).
// Copied from the UI's current layout so the server does not depend on the mock data file.
export const CELL_ZONES: string[] = [
  // Row 1 (1-10): Head & Occipital
  "OCCIPITAL", "OCCIPITAL", "OCCIPITAL", "CERVICAL", "CERVICAL", "CERVICAL", "CERVICAL", "OCCIPITAL", "OCCIPITAL", "OCCIPITAL",
  // Row 2 (11-20): Cervical / Upper Trapezius
  "OCCIPITAL", "CERVICAL", "CERVICAL", "CERVICAL", "CERVICAL", "CERVICAL", "CERVICAL", "CERVICAL", "CERVICAL", "OCCIPITAL",
  // Row 3 (21-30): Shoulders & Scapular Upper
  "SCAPULA-L", "SCAPULA-L", "SCAPULA-L", "THORACIC", "THORACIC", "THORACIC", "THORACIC", "SCAPULA-R", "SCAPULA-R", "SCAPULA-R",
  // Row 4 (31-40): Scapular & Thoracic Mid
  "SCAPULA-L", "SCAPULA-L", "THORACIC", "THORACIC", "SPINE-MID", "SPINE-MID", "THORACIC", "THORACIC", "SCAPULA-R", "SCAPULA-R",
  // Row 5 (41-50): Mid Spine & Lower Thoracic
  "THORACIC", "THORACIC", "THORACIC", "SPINE-MID", "SPINE-MID", "SPINE-MID", "SPINE-MID", "THORACIC", "THORACIC", "THORACIC",
  // Row 6 (51-60): Lumbar Spine & Flanks
  "LUMBAR-L", "LUMBAR-L", "LUMBAR-L", "LUMBAR", "LUMBAR", "LUMBAR", "LUMBAR", "LUMBAR-R", "LUMBAR-R", "LUMBAR-R",
  // Row 7 (61-70): Iliac Crests & Upper Sacrum
  "ILIAC-L", "ILIAC-L", "SACRAL-L", "SACRAL-L", "SACRAL", "SACRAL", "SACRAL-R", "SACRAL-R", "ILIAC-R", "ILIAC-R",
  // Row 8 (71-80): Trochanters, Gluteal, Coccyx (Sacral Peak Zone)
  "TROCHANTER", "TROCHANTER", "GLUTEAL", "GLUTEAL", "COCCYX", "COCCYX", "GLUTEAL", "GLUTEAL", "TROCHANTER", "TROCHANTER",
  // Row 9 (81-90): Femoral, Popliteal & Calves
  "POPLITEAL", "POPLITEAL", "POPLITEAL", "CALF-MID", "CALF-MID", "CALF-MID", "CALF-MID", "POPLITEAL", "POPLITEAL", "POPLITEAL",
  // Row 10 (91-100): Calcaneus (Heels), Achilles & Plantar
  "ACHILLES", "ACHILLES", "HEEL-L", "HEEL-L", "PLANTAR", "PLANTAR", "HEEL-R", "HEEL-R", "ACHILLES", "ACHILLES"
];
