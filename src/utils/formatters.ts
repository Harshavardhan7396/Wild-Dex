import React from 'react';

/**
 * Standard friendly labels for conservation status (6th-grade reading level)
 */
export function formatConservationStatus(codeOrLabel?: string): string {
  if (!codeOrLabel) return 'Common, Not in Danger';
  const upper = codeOrLabel.toUpperCase();

  if (upper.includes('CRITICALLY') || upper === 'CR') {
    return 'In Serious Danger';
  }
  if (upper.includes('ENDANGERED') || upper === 'EN') {
    return 'In Danger';
  }
  if (upper.includes('VULNERABLE') || upper === 'VU') {
    return 'At Risk';
  }
  if (upper.includes('NEAR THREATENED') || upper === 'NT') {
    return 'Could Be in Danger Soon';
  }
  if (upper.includes('EXTINCT') || upper === 'EX' || upper === 'EW') {
    return 'No Longer Exists';
  }
  if (upper.includes('LEAST CONCERN') || upper === 'LC') {
    return 'Common, Not in Danger';
  }
  return codeOrLabel;
}

/**
 * "What does this mean?" explanation text for conservation status
 */
export function getConservationMeaning(codeOrLabel?: string): string {
  const formatted = formatConservationStatus(codeOrLabel);
  if (formatted === 'In Serious Danger') {
    return 'Very few are left in the wild. They need immediate help and protection so they do not disappear forever.';
  }
  if (formatted === 'In Danger') {
    return 'Their numbers in the wild are dropping fast due to habitat loss or threats. They need active protection.';
  }
  if (formatted === 'At Risk') {
    return 'They face real challenges in the wild and could become in danger soon if we do not protect their homes.';
  }
  if (formatted === 'Could Be in Danger Soon') {
    return 'Currently okay, but their population is slowly decreasing and needs watching.';
  }
  if (formatted === 'No Longer Exists') {
    return 'None of these live in the wild anymore.';
  }
  return 'There are plenty of them living safely in the wild. They are not currently at risk.';
}

/**
 * "What does this mean?" explanation text for Match Score
 */
export function getMatchScoreMeaning(scoreDecimal: number): string {
  const percent = Math.round(scoreDecimal * 100);
  if (percent >= 85) {
    return `We are ${percent}% sure this matches because the photo clearly shows key colors, shapes, and features.`;
  }
  if (percent >= 60) {
    return `We are ${percent}% sure. The photo looks like this species, but take a closer or clearer photo to be certain.`;
  }
  return `Only ${percent}% sure because the photo might be blurry, too far away, or partly hidden. Check Other Possible Matches!`;
}

/**
 * Format match score as friendly percentage
 */
export function formatMatchScore(scoreDecimal: number): string {
  const pct = Math.round(scoreDecimal * 100);
  return `${pct}% sure`;
}

/**
 * Friendly Safety Tips
 */
export function formatSafetyTip(flag: 'venomous' | 'toxic' | 'invasive'): { title: string; subtitle: string } {
  switch (flag) {
    case 'venomous':
      return {
        title: 'Poisonous Bite or Sting',
        subtitle: 'Can deliver venom if touched or startled. Stay back safely.',
      };
    case 'toxic':
      return {
        title: 'Poisonous to Touch or Eat',
        subtitle: 'Contains poison. Do not touch or eat this plant or animal.',
      };
    case 'invasive':
      return {
        title: 'Harms Local Nature',
        subtitle: 'Takes over food and homes from local animals and plants.',
      };
  }
}
