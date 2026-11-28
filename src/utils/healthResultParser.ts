import type {
  DetailedHealthResult,
  FoodAvoidItem,
  FoodHelpItem,
  LikelihoodWord,
  MainPossibility,
  OtherPossibility,
  SeriousnessLevel,
} from '../components/health/HealthResultSection';

function toCleanString(raw: unknown): string | undefined {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(raw)) {
    const joined = raw
      .filter((v): v is string => typeof v === 'string' && Boolean(v.trim()))
      .map((v) => v.trim())
      .join(' ');
    return joined || undefined;
  }
  return undefined;
}

function normalizeSeriousness(raw: unknown, emergencyFlag: boolean): SeriousnessLevel | undefined {
  if (typeof raw === 'string' && raw.trim()) {
    const lower = raw.trim().toLowerCase();
    if (
      lower.includes('high') ||
      lower.includes('urgent') ||
      lower.includes('critical') ||
      lower.includes('severe') ||
      lower.includes('emergency')
    ) {
      return 'High';
    }
    if (lower.includes('medium') || lower.includes('moderate')) {
      return 'Medium';
    }
    if (lower.includes('low') || lower.includes('mild')) {
      return 'Low';
    }
  }
  if (emergencyFlag) return 'High';
  return undefined;
}

function normalizeLikelihood(raw: unknown): LikelihoodWord | undefined {
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    if (raw <= 1) {
      if (raw >= 0.7) return 'Likely';
      if (raw >= 0.35) return 'Possible';
      return 'Unlikely';
    }
    if (raw >= 70) return 'Likely';
    if (raw >= 35) return 'Possible';
    return 'Unlikely';
  }
  if (typeof raw === 'string' && raw.trim()) {
    const lower = raw.trim().toLowerCase();
    const numMatch = lower.match(/\d+/);
    if (lower.includes('%') && numMatch) {
      const pct = Number(numMatch[0]);
      if (pct >= 70) return 'Likely';
      if (pct >= 35) return 'Possible';
      return 'Unlikely';
    }
    if (lower.includes('unlikely') || lower.includes('low') || lower.includes('rare')) {
      return 'Unlikely';
    }
    if (lower.includes('likely') || lower.includes('high') || lower.includes('probable') || lower.includes('very')) {
      return 'Likely';
    }
    if (lower.includes('possible') || lower.includes('moderate') || lower.includes('medium') || lower.includes('maybe')) {
      return 'Possible';
    }
    return 'Possible';
  }
  return undefined;
}

function toStringList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const head = [obj.title, obj.name, obj.step, obj.action, obj.label, obj.question]
            .find((v) => typeof v === 'string' && v.trim());
          const body = [obj.description, obj.text, obj.detail, obj.details, obj.note, obj.notes]
            .find((v) => typeof v === 'string' && v.trim());
          if (typeof head === 'string' && typeof body === 'string') {
            return `${head.trim()}: ${body.trim()}`;
          }
          if (typeof head === 'string') return head.trim();
          if (typeof body === 'string') return body.trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : [trimmed];
  }
  return [];
}

function parseMainPossibility(raw: unknown): MainPossibility | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    const name = raw.trim();
    return name ? { name } : undefined;
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const name = toCleanString(obj.name ?? obj.title ?? obj.possibility ?? obj.condition ?? obj.label);
    if (!name) return undefined;
    return {
      name,
      explanation: toCleanString(obj.explanation ?? obj.description ?? obj.summary ?? obj.detail),
      whyItMatches: toCleanString(obj.whyItMatches ?? obj.why_it_matches ?? obj.reason),
      likelihood: normalizeLikelihood(obj.likelihood ?? obj.probability ?? obj.confidence),
    };
  }
  return undefined;
}

function parseOtherPossibilities(raw: unknown): OtherPossibility[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item): OtherPossibility | null => {
        if (typeof item === 'string') {
          const name = item.trim();
          return name ? { name } : null;
        }
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          const name = toCleanString(obj.name ?? obj.title ?? obj.possibility ?? obj.condition ?? obj.label);
          if (!name) return null;
          return {
            name,
            explanation: toCleanString(
              obj.explanation ?? obj.description ?? obj.whyItMatches ?? obj.reason ?? obj.detail ?? obj.note
            ),
            likelihood: normalizeLikelihood(obj.likelihood ?? obj.probability ?? obj.confidence),
          };
        }
        return null;
      })
      .filter((item): item is OtherPossibility => item !== null);
  }
  if (typeof raw === 'string') {
    return toStringList(raw).map((name) => ({ name }));
  }
  return [];
}

function parseFoodsThatHelp(raw: unknown): FoodHelpItem[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === 'string') {
      return toStringList(raw).map((name) => ({ name }));
    }
    return [];
  }
  return raw
    .map((item): FoodHelpItem | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name } : null;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const name = toCleanString(obj.name ?? obj.title ?? obj.food ?? obj.item);
        if (!name) return null;
        return {
          name,
          whyItHelps: toCleanString(obj.whyItHelps ?? obj.why_it_helps ?? obj.benefit ?? obj.why ?? obj.description),
          howToGive: toCleanString(obj.howToGive ?? obj.how_to_give ?? obj.serving ?? obj.instructions ?? obj.howToUse),
        };
      }
      return null;
    })
    .filter((item): item is FoodHelpItem => item !== null);
}

function parseFoodsToAvoid(raw: unknown): FoodAvoidItem[] {
  if (!Array.isArray(raw)) {
    if (typeof raw === 'string') {
      return toStringList(raw).map((name) => ({ name }));
    }
    return [];
  }
  return raw
    .map((item): FoodAvoidItem | null => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name } : null;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const name = toCleanString(obj.name ?? obj.title ?? obj.food ?? obj.item);
        if (!name) return null;
        return {
          name,
          why: toCleanString(obj.why ?? obj.reason ?? obj.risk ?? obj.description),
        };
      }
      return null;
    })
    .filter((item): item is FoodAvoidItem => item !== null);
}

export function parseHealthResponse(rawData: any): DetailedHealthResult {
  const payload = rawData?.data && typeof rawData.data === 'object' ? rawData.data : rawData;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Unexpected response from health check.');
  }

  const emergency = Boolean(
    payload.emergency ?? payload.isEmergency ?? payload.is_emergency
  );

  const seriousness = normalizeSeriousness(
    payload.seriousness ??
      payload.severity ??
      payload.howSeriousIsIt ??
      payload.how_serious_is_it,
    emergency
  );

  return {
    simpleSummary: toCleanString(payload.simpleSummary ?? payload.simple_summary ?? payload.summary),
    mainPossibility: parseMainPossibility(
      payload.mainPossibility ??
        payload.main_possibility ??
        payload.primaryPossibility ??
        payload.mostLikely
    ),
    otherPossibilities: parseOtherPossibilities(
      payload.otherPossibilities ?? payload.other_possibilities ?? payload.alternatives
    ),
    seriousness,
    seriousnessReason: toCleanString(payload.seriousnessReason ?? payload.seriousness_reason),
    emergency,
    warningSigns: toStringList(payload.warningSigns ?? payload.warning_signs),
    whatToDoNow: toStringList(payload.whatToDoNow ?? payload.what_to_do_now ?? payload.careSteps),
    foodsThatHelp: parseFoodsThatHelp(
      payload.foodsThatHelp ?? payload.foods_that_help ?? payload.foodsOrCareThatHelp
    ),
    foodsToAvoid: parseFoodsToAvoid(
      payload.foodsToAvoid ?? payload.foods_to_avoid ?? payload.thingsToAvoid
    ),
    waterRestAndCare: toStringList(
      payload.waterRestAndCare ?? payload.water_rest_and_care ?? payload.supportiveCare
    ),
    howLongToRecover: toCleanString(payload.howLongToRecover ?? payload.how_long_to_recover),
    prevention: toStringList(payload.prevention ?? payload.preventionTips),
    whenToSeeExpert: toCleanString(
      payload.whenToSeeExpert ?? payload.when_to_see_expert ?? payload.whenToSeeVet
    ),
    questionsToAskExpert: toStringList(
      payload.questionsToAskExpert ?? payload.questions_to_ask_expert ?? payload.questionsToAsk
    ),
  };
}
