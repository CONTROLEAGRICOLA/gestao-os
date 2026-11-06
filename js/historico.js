// =============================================================
// historico.js: a linha do tempo da OS (quem fez o quê, e quando)
// =============================================================
import { buscarHistorico } from './api.js';
import { criar, numeroBR } from './util.js';

const TITULOS = {
    'ENVIOU': 'Solicitação enviada',
    'REENVIOU': 'Corrigida e reenviada',
    'LANÇOU': 'Lançada',
    'REJEITOU': 'Rejeitada',
    'ANEXOU PDF': 'PDF anexado',
    'EDITOU': 'Editada pelo analista',
    'CANCELOU': 'Cancelada'
};

let pedidoAtual = 0;   // para ignorar resposta de uma OS que já não está aberta

export async function desenharHistorico(os) {
    const secao = document.getElementById('historico');
    const lista = document.getElementById('historico-lista');
    secao.hidden = false;
    lista.replaceChildren(criar('li', 'evento-aviso', 'Carregando histórico…'));

    const pedido = ++pedidoAtual;
    let registros;
    try {
        registros = await buscarHistorico(os.codigoTemp);
    } catch (erro) {
        if (pedido === pedidoAtual) {
            lista.replaceChildren(criar('li', 'evento-aviso', 'Não deu para carregar o histórico.'));
        }
        return;
    }
    if (pedido !== pedidoAtual) return;   // abriram outra OS enquanto este carregava

    // OS antiga (de antes do log): o envio vem dos próprios dados da OS
    const temEnvio = registros.some(r => r.acao === 'ENVIOU');
    if (!temEnvio) {
        registros.unshift({ acao: 'ENVIOU', quem: os.solicitante_nome, quando: os.dataSincronizacao, depois: '' });
    }

    lista.replaceChildren(...agruparEdicoes(registros).map(evento));
}

function evento(registro) {
    const item = criar('li', 'evento');
    item.dataset.acao = registro.acao;

    let titulo = TITULOS[registro.acao] || registro.acao;
    if (registro.acao === 'LANÇOU' && registro.depois) titulo += ' como ' + registro.depois;
    // No LOG, o CAMPO do cancelamento diz quem cancelou: "Cancelado pelo líder" vira "Cancelada pelo líder"
    if (registro.acao === 'CANCELOU' && registro.campo) titulo = registro.campo.replace('Cancelado', 'Cancelada');
    item.append(
        criar('strong', '', titulo),
        criar('span', '', [registro.quem, registro.quando].filter(Boolean).join(' · '))
    );

    if ((registro.acao === 'REJEITOU' || registro.acao === 'CANCELOU') && registro.depois) {
        item.append(criar('span', 'evento-detalhe', registro.depois));
    }
    if (registro.acao === 'EDITOU') {
        for (const m of registro.mudancas) {
            const antes = valorLegivel(m.campo, m.antes);
            const depois = valorLegivel(m.campo, m.depois);
            item.append(criar('span', 'evento-detalhe', `${m.campo}: ${antes} → ${depois}`));
        }
    }
    return item;
}

// Edições salvas juntas (mesmo analista, mesmo minuto) viram um item só, com uma linha por campo
function agruparEdicoes(registros) {
    const resultado = [];
    for (const r of registros) {
        const anterior = resultado[resultado.length - 1];
        const juntar = r.acao === 'EDITOU' && anterior && anterior.acao === 'EDITOU'
            && anterior.quem === r.quem && anterior.quando === r.quando;

        if (juntar) anterior.mudancas.push(r);
        else if (r.acao === 'EDITOU') resultado.push({ ...r, mudancas: [r] });
        else resultado.push(r);
    }
    return resultado;
}

// Deixa o antes/depois fácil de ler: 2026-10-28 → 28/10/2026 · 16.13 → 16,13 ha
function valorLegivel(campo, valor) {
    const texto = String(valor ?? '').trim();
    if (texto === '') return '(vazio)';

    const data = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (data) return `${data[3]}/${data[2]}/${data[1]}`;

    if (campo === 'Área total') return numeroBR(texto) + ' ha';
    return texto;
}
