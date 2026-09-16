export function fusoValido(fuso: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: fuso }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function dataCivil(agora: Date, fuso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const get = (tipo: string) => parts.find((p) => p.type === tipo)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function adicionarDiasCivis(ymd: string, dias: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d + dias);
  const date = new Date(utc);
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${mm}-${dd}`;
}

export function instanteCivil(
  ymd: string,
  hora: number,
  minuto: number,
  segundo: number,
  fuso: string,
): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  const civilUtc = Date.UTC(year, month - 1, day, hora, minuto, segundo);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const asUtcNumber = (ms: number) => {
    const parts = dtf.formatToParts(new Date(ms));
    const get = (tipo: string) => Number(parts.find((p) => p.type === tipo)?.value);
    return Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
  };
  let guess = civilUtc;
  for (let i = 0; i < 3; i += 1) {
    guess += civilUtc - asUtcNumber(guess);
  }
  return new Date(guess);
}

export function limitesDoDia(ymd: string, fuso: string) {
  const inicio = instanteCivil(ymd, 0, 0, 0, fuso);
  const fim = instanteCivil(adicionarDiasCivis(ymd, 1), 0, 0, 0, fuso);
  return { inicio, fim };
}
