import { BALANCE } from '../data/balance';
import type { LinhaRelatorio, Resources } from './types';
import { formatarDinheiro } from './resources';

export interface BalancoMensal {
  delta: number;
  linhas: LinhaRelatorio[];
}

/** Calcula entradas e saídas fixas do mês (pura). */
export function balancoMensal(res: Resources): BalancoMensal {
  const e = BALANCE.economia;
  const linhas: LinhaRelatorio[] = [
    { rotulo: 'Salário de vereador', valor: `+${formatarDinheiro(e.salario)}`, tipo: 'bom' },
    { rotulo: 'Gabinete e equipe', valor: `-${formatarDinheiro(e.despesasGabinete)}`, tipo: 'ruim' },
  ];
  let delta = e.salario - e.despesasGabinete;
  if (res.dinheiro < 0) {
    const juros = Math.round(-res.dinheiro * e.jurosDivida);
    delta -= juros;
    linhas.push({ rotulo: 'Juros da dívida', valor: `-${formatarDinheiro(juros)}`, tipo: 'ruim' });
  }
  return { delta, linhas };
}
