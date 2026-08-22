// Best-effort US state → time zone lookup for auto-populating a client's time
// zone from a "City, State" (or just "State") location field. Several states
// span more than one zone (TX, FL, TN, MI, KY, ID, ND, SD, NE, KS, OR, NV) —
// this uses whichever zone covers the state's population/economic center,
// which is right often enough to be a useful starting point, not a
// guarantee. The field stays freely editable so a wrong guess is a one-click fix.
const STATE_TIME_ZONES: Record<string, string> = {
  AL: 'Central',
  AK: 'Alaska',
  AZ: 'Mountain',
  AR: 'Central',
  CA: 'Pacific',
  CO: 'Mountain',
  CT: 'Eastern',
  DE: 'Eastern',
  DC: 'Eastern',
  FL: 'Eastern',
  GA: 'Eastern',
  HI: 'Hawaii',
  ID: 'Mountain',
  IL: 'Central',
  IN: 'Eastern',
  IA: 'Central',
  KS: 'Central',
  KY: 'Eastern',
  LA: 'Central',
  ME: 'Eastern',
  MD: 'Eastern',
  MA: 'Eastern',
  MI: 'Eastern',
  MN: 'Central',
  MS: 'Central',
  MO: 'Central',
  MT: 'Mountain',
  NE: 'Central',
  NV: 'Pacific',
  NH: 'Eastern',
  NJ: 'Eastern',
  NM: 'Mountain',
  NY: 'Eastern',
  NC: 'Eastern',
  ND: 'Central',
  OH: 'Eastern',
  OK: 'Central',
  OR: 'Pacific',
  PA: 'Eastern',
  RI: 'Eastern',
  SC: 'Eastern',
  SD: 'Central',
  TN: 'Central',
  TX: 'Central',
  UT: 'Mountain',
  VT: 'Eastern',
  VA: 'Eastern',
  WA: 'Pacific',
  WV: 'Eastern',
  WI: 'Central',
  WY: 'Mountain',
  PR: 'Atlantic'
}

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'puerto rico': 'PR'
}

// Accepts "City, State", "State", or a state abbreviation.
export function guessTimeZoneFromLocation(location: string): string | null {
  const parts = location
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  const stateGuess = parts[parts.length - 1]

  const abbr = /^[A-Za-z]{2}$/.test(stateGuess)
    ? stateGuess.toUpperCase()
    : STATE_NAME_TO_ABBR[stateGuess.toLowerCase()]

  return abbr ? (STATE_TIME_ZONES[abbr] ?? null) : null
}
