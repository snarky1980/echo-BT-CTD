export const normalizeVarKey = (name) => {
  if (!name) return ''
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return ''
  const lowered = trimmed.toLowerCase()
  const withoutSuffix = lowered.replace(/_(fr|en)$/i, '')
  return withoutSuffix.replace(/[^a-z0-9]+/g, '')
}

export const varKeysMatch = (a, b) => {
  if (!a || !b) return false
  return normalizeVarKey(a) === normalizeVarKey(b)
}

export const LANGUAGE_SUFFIXES = ['FR', 'EN']

const toCanonicalVarKey = (name = '') => {
  if (!name) return ''
  const trimmed = String(name).trim()
  if (!trimmed) return ''

  const withoutAngles = trimmed.replace(/[<>]/g, '')
  const withUnderscores = withoutAngles
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')

  return withUnderscores
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

const collectMatchingVariableKeys = (variables = {}, varName = '') => {
  if (!variables || typeof variables !== 'object') return []
  const target = normalizeVarKey(varName)
  if (!target) return []
  const matches = []
  for (const key of Object.keys(variables)) {
    if (normalizeVarKey(key) === target) {
      matches.push(key)
    }
  }
  return matches
}

const joinWithSuffix = (base = '', suffix = '') => {
  if (!base) return ''
  const trimmedBase = String(base).replace(/_+$/g, '')
  const upperSuffix = String(suffix || '').toUpperCase()
  if (!upperSuffix) return trimmedBase
  return `${trimmedBase}_${upperSuffix}`
}

export const expandVariableAssignment = (varName, rawValue, options = {}) => {
  const assignments = {}
  if (!varName) return assignments

  const value = rawValue == null ? '' : String(rawValue)
  const preferredLanguage = options?.preferredLanguage
    ? String(options.preferredLanguage).toUpperCase()
    : null
  const variables = options?.variables && typeof options.variables === 'object'
    ? options.variables
    : {}

  const normalizedTarget = normalizeVarKey(varName)
  const suffixMatch = String(varName).match(/_(FR|EN)$/i)
  const suffix = suffixMatch ? suffixMatch[1].toUpperCase() : null
  const baseOriginal = suffix ? String(varName).slice(0, -1 * (suffix.length + 1)) : String(varName)
  const canonicalBase = toCanonicalVarKey(baseOriginal)

  const addKey = (key) => {
    if (!key) return
    const trimmedKey = String(key).trim()
    if (!trimmedKey) return
    if (!Object.prototype.hasOwnProperty.call(assignments, trimmedKey)) {
      assignments[trimmedKey] = value
    }
  }

  addKey(String(varName))

  collectMatchingVariableKeys(variables, varName).forEach(addKey)

  if (suffix) {
    addKey(baseOriginal)
    if (canonicalBase) {
      addKey(canonicalBase)
      addKey(joinWithSuffix(canonicalBase, suffix))
    }
  } else {
    if (canonicalBase) {
      addKey(canonicalBase)
    }

    const suffixes = preferredLanguage && LANGUAGE_SUFFIXES.includes(preferredLanguage)
      ? [preferredLanguage]
      : LANGUAGE_SUFFIXES

    suffixes.forEach((suf) => {
      addKey(joinWithSuffix(baseOriginal, suf))
      if (canonicalBase) {
        addKey(joinWithSuffix(canonicalBase, suf))
      }
    })
  }

  return assignments
}

export const resolveVariableValue = (variables = {}, name = '', templateLanguage = 'fr') => {
  if (!variables || typeof variables !== 'object' || !name) return ''

  const safeName = String(name)
  const direct = variables[safeName]
  if (direct !== undefined && direct !== null) return String(direct)

  // Attempt case-insensitive direct lookup
  const lowerName = safeName.toLowerCase()
  if (lowerName !== safeName) {
    const lowerDirect = variables[lowerName]
    if (lowerDirect !== undefined && lowerDirect !== null) return String(lowerDirect)
  }

  const normalizedTarget = normalizeVarKey(safeName)
  if (!normalizedTarget) return ''

  const requestedSuffix = safeName.match(/_(fr|en)$/i)?.[1]?.toLowerCase() || null
  const preferredLang = (templateLanguage || 'fr').toLowerCase()
  let langMatch = null
  let baseMatch = null
  let anyMatch = null

  const debugMatches = []
  for (const [key, value] of Object.entries(variables)) {
    if (value === undefined || value === null) continue
    const normalizedKey = normalizeVarKey(key)
    if (normalizedKey === normalizedTarget) {
      debugMatches.push({ key, value: String(value).substring(0, 20), normalizedKey })
    }
    if (normalizedKey !== normalizedTarget) continue

    const keySuffix = key.match(/_(fr|en)$/i)?.[1]?.toLowerCase() || null
    const stringValue = String(value)

    if (requestedSuffix) {
      if (keySuffix === requestedSuffix) return stringValue
      if (!keySuffix && !baseMatch) baseMatch = stringValue
      continue
    }

    if (!keySuffix) {
      if (!baseMatch) baseMatch = stringValue
      continue
    }

    if (keySuffix === preferredLang && !langMatch) {
      langMatch = stringValue
    }

    if (!anyMatch) {
      anyMatch = stringValue
    }
  }

  return langMatch || baseMatch || anyMatch || ''
}
