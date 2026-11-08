function attempt(make) {
  try {
    return make();
  } catch {
    return null;
  }
}

export function createFormatters(locale, currency) {
  const loc = locale || 'en-US';
  const code = currency && currency.code ? currency.code : null;
  const symbol = currency && currency.symbol ? currency.symbol : '';
  const moneyFmt = code ? attempt(() => new Intl.NumberFormat(loc, { style: 'currency', currency: code, maximumFractionDigits: 0 })) : null;
  const intFmt = attempt(() => new Intl.NumberFormat(loc, { maximumFractionDigits: 0 }));
  const decFmt = attempt(() => new Intl.NumberFormat(loc, { maximumFractionDigits: 2 }));
  const pctFmt = attempt(() => new Intl.NumberFormat(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const compactFmt = attempt(() => new Intl.NumberFormat(loc, { notation: 'compact', maximumFractionDigits: 1 }));
  const dateFmt = attempt(() => new Intl.DateTimeFormat(loc, { dateStyle: 'medium' }));
  const dateTimeFmt = attempt(() => new Intl.DateTimeFormat(loc, { dateStyle: 'medium', timeStyle: 'short' }));

  const ok = v => typeof v === 'number' && Number.isFinite(v);
  const dash = '-';
  const integer = v => (ok(v) ? (intFmt ? intFmt.format(v) : String(Math.round(v))) : dash);
  const decimal = v => (ok(v) ? (decFmt ? decFmt.format(v) : String(Math.round(v * 100) / 100)) : dash);
  const percent = v => (ok(v) ? (pctFmt ? pctFmt.format(v) : v.toFixed(1)) + '%' : dash);
  const money = v => {
    if (!ok(v)) return dash;
    if (moneyFmt) return moneyFmt.format(v);
    return symbol + integer(v);
  };
  const compact = v => (ok(v) ? (compactFmt ? compactFmt.format(v) : String(Math.round(v))) : dash);
  const number = v => (ok(v) ? (Math.abs(v) >= 1000 ? compact(v) : decimal(v)) : dash);
  const parse = v => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const date = v => {
    const d = parse(v);
    return d ? (dateFmt ? dateFmt.format(d) : d.toDateString()) : dash;
  };
  const dateTime = v => {
    const d = parse(v);
    return d ? (dateTimeFmt ? dateTimeFmt.format(d) : d.toString()) : dash;
  };
  const relative = (v, now = Date.now()) => {
    const d = parse(v);
    if (!d) return 'unknown';
    const minutes = Math.round((now - d.getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' minutes ago';
    const hours = Math.round(minutes / 60);
    if (hours < 48) return hours + ' hours ago';
    return Math.round(hours / 24) + ' days ago';
  };
  const byFormat = (format, v) => {
    switch (format) {
      case 'currency': return money(v);
      case 'percent': return percent(v);
      case 'integer': return integer(v);
      case 'decimal': return decimal(v);
      default: return v === null || v === undefined ? dash : String(v);
    }
  };
  return { integer, decimal, percent, money, compact, number, date, dateTime, relative, byFormat };
}
