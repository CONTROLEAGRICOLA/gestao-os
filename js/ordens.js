// =============================================================
// ordens.js: junta cada abertura lançada com os apontamentos dela
// e descobre a situação da OS (só contas, nada de tela)
// =============================================================
import { lerDataBR, lerTalhoes } from './util.js';

const LANCADA = 'OS Lançada';

export const SITUACOES = {
    aberta: 'Aberta',
    execucao: 'Em execução',
    pendente: 'Encerramento pendente',
    encerrada: 'Encerrada'
};

// Lista da planilha (solicitações) → lista de OS
export function montarOrdens(lista) {
    // 1) Apontamentos e encerramentos, separados pelo código da abertura (os_origem)
    const filhosPorAbertura = new Map();
    for (const registro of lista) {
        if (registro.tipo_registro === 'LANCAMENTO' || !registro.os_origem) continue;
        if (!filhosPorAbertura.has(registro.os_origem)) filhosPorAbertura.set(registro.os_origem, []);
        filhosPorAbertura.get(registro.os_origem).push(registro);
    }

    // 2) Cada abertura lançada vira uma OS, com os filhos dela
    return lista
        .filter(registro => registro.tipo_registro === 'LANCAMENTO' && registro.status_aprovacao === LANCADA)
        .map(abertura => montarUma(abertura, filhosPorAbertura.get(abertura.codigoTemp) || []));
}

function montarUma(abertura, filhos) {
    const apontamentos = filhos
        .slice()
        .sort((a, b) => lerDataBR(a.dataSincronizacao) - lerDataBR(b.dataSincronizacao));   // mais antigo primeiro
    const lancados = apontamentos.filter(a => a.status_aprovacao === LANCADA);

    const areaPrevista = Number(abertura.area_total) || 0;
    const areaFeita = lancados.reduce((soma, a) => soma + (Number(a.area_total) || 0), 0);
    const ultimo = apontamentos[apontamentos.length - 1];

    return {
        abertura,
        apontamentos,
        lancados: lancados.length,
        situacao: situacaoDa(apontamentos, lancados),
        areaPrevista,
        areaFeita,
        pct: areaPrevista > 0 ? Math.min(100, Math.round(areaFeita / areaPrevista * 100)) : 0,
        ultimaData: ultimo ? ultimo.dataSincronizacao : abertura.dataSincronizacao
    };
}

// A ordem dos "if" importa: do mais forte (encerrada) para o mais fraco (aberta)
function situacaoDa(apontamentos, lancados) {
    const encerramentos = apontamentos.filter(a => a.tipo_registro === 'ENCERRAMENTO');
    if (encerramentos.some(a => a.status_aprovacao === LANCADA)) return 'encerrada';
    if (encerramentos.some(a => a.status_aprovacao === 'Em análise')) return 'pendente';
    if (lancados.length > 0) return 'execucao';
    return 'aberta';
}

// Previsto × apontado, talhão por talhão (só conta apontamento lançado)
export function andamentoPorTalhao(ordem) {
    const feito = new Map();
    for (const a of ordem.apontamentos) {
        if (a.status_aprovacao !== LANCADA) continue;
        for (const t of lerTalhoes(a.talhoes)) {
            feito.set(t.numero, (feito.get(t.numero) || 0) + t.area);
        }
    }
    return lerTalhoes(ordem.abertura.talhoes).map(t => ({
        numero: t.numero,
        previsto: t.area,
        feito: feito.get(t.numero) || 0
    }));
}