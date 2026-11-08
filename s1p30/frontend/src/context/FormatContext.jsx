import { createContext, useContext, useMemo } from 'react';
import { createFormatters } from '../utils/formatters.js';

const FormatContext = createContext(createFormatters('en-US', { code: 'USD', symbol: '$' }));

export function FormatProvider({ summary, children }) {
  const locale = summary ? summary.locale : 'en-US';
  const currency = summary && summary.currency !== undefined ? summary.currency : { code: 'USD', symbol: '$' };
  const formatters = useMemo(() => createFormatters(locale, currency), [locale, currency]);
  return <FormatContext.Provider value={formatters}>{children}</FormatContext.Provider>;
}

export function useFormat() {
  return useContext(FormatContext);
}
