// =============================================================
// filtros.js: decide quais OS aparecem (abas, tipo, período, busca)
// =============================================================
import { estado } from './estado.js';
import { lerDataBR, semAcento } from './util.js';
import { responsavelDaOS } from './analistas.js';

const STATUS_DA_ABA = {
    afazer: 'Em análise',
    lancadas: 'OS Lançada',
    rejeitadas: 'Rejeitado'
};

const UM_DIA = 24 * 60 * 60 * 1000;   // em milissegundos

// A OS passa no tipo, no período e na busca? (a aba é vista à parte)
function passaNosFiltros(os) {
    if (!estado.tipos.has(os.tipo_registro)) return false;

    // Pendente aparece sempre: o período só vale para o que já foi resolvido
    if (estado.periodo > 0 && os.status_aprovacao !== 'Em análise') {
        const limite = Date.now() - estado.periodo * UM_DIA;
        if (lerDataBR(os.dataSincronizacao) < limite) return false;
    }

        const responsavel = responsavelDaOS(os);
        // Analistas escolhidos: mostra as deles e as que ainda não têm responsável na base
    if (estado.verOSde.size > 0 && responsavel && !estado.verOSde.has(responsavel.id)) return false;

    if (estado.busca) {
        const ondeProcurar = semAcento([
            os.codigoTemp, os.codigoOS, os.numero_origem, os.fa_codigo,
            os.descricao_fazenda, os.solicitante_nome, os.operacao, responsavel?.nome
        ].join(' '));
        if (!ondeProcurar.includes(estado.busca)) return false;
    }

    return true;
}

function estaNaAba(os, aba) {
    if (aba === 'todas') return true;
    return os.status_aprovacao === STATUS_DA_ABA[aba];
}

// A lista que a fila mostra agora
export function listaDaFila() {
    const lista = estado.lista.filter(os => passaNosFiltros(os) && estaNaAba(os, estado.aba));

    // A ordem que o analista escolheu para esta aba (o botão no topo da fila)
    const sentido = estado.ordem[estado.aba] === 'antigo' ? 1 : -1;
    return lista.sort((a, b) => sentido * (lerDataBR(a.dataSincronizacao) - lerDataBR(b.dataSincronizacao)));
}

// Quantas OS cada aba tem, já com os filtros de tipo, período e busca
export function contarPorAba() {
    const contagem = { afazer: 0, lancadas: 0, rejeitadas: 0, todas: 0 };
    for (const os of estado.lista) {
        if (!passaNosFiltros(os)) continue;
        contagem.todas++;
        if (estaNaAba(os, 'afazer')) contagem.afazer++;
        if (estaNaAba(os, 'lancadas')) contagem.lancadas++;
        if (estaNaAba(os, 'rejeitadas')) contagem.rejeitadas++;
    }
    return contagem;
}