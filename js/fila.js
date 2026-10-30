// =============================================================
// fila.js: desenha a coluna da esquerda (a fila de trabalho)
// =============================================================
import { criar, tempoDeEspera, tituloDaOS, NOMES_DOS_TIPOS, redesenhar } from './util.js';
import { estado } from './estado.js';
import { ehReenvio } from './notificacoes.js';

export function desenharFila(lista) {
    // Mesma aba, ordem e filtros = é só uma atualização: a rolagem fica onde estava
    const chave = [estado.aba, estado.ordem[estado.aba], [...estado.tipos], estado.periodo, estado.busca, [...estado.verOSde]].join('|');
    const itens = lista.length > 0 ? lista.map(criarItem) : [criar('p', 'fila-vazia', 'Nada por aqui.')];
    redesenhar(document.getElementById('fila-lista'), chave, itens);
}

function criarItem(os) {
    const item = criar('button', 'item-fila');
    item.type = 'button';
    item.dataset.codigo = os.codigoTemp;
    if (os.codigoTemp === estado.selecionada) item.classList.add('selecionado');

    const topo = criar('span', 'item-topo');
    const reenvio = ehReenvio(os);
    const tag = criar('span', 'tag', reenvio ? 'Reenvio' : (NOMES_DOS_TIPOS[os.tipo_registro] || os.tipo_registro));
    tag.dataset.tipo = reenvio ? 'REENVIO' : os.tipo_registro;
    topo.append(tag, situacao(os));

    item.append(
        topo,
        criar('span', 'item-titulo', tituloDaOS(os)),
        criar('span', 'item-fazenda', [os.fa_codigo, os.descricao_fazenda].filter(Boolean).join(' · ')),
        criar('span', 'item-info', [os.operacao, os.solicitante_nome].filter(Boolean).join(' · '))
    );
    return item;
}

// Em análise: há quanto tempo espera. Nas outras: a situação (OS Lançada, Rejeitado)
function situacao(os) {
    if (os.status_aprovacao === 'Em análise') {
        const espera = tempoDeEspera(os.dataSincronizacao);
        return criar('span', 'espera ' + espera.nivel, espera.texto);
    }
    const selo = criar('span', 'status-os', os.status_aprovacao);
    selo.dataset.status = os.status_aprovacao;
    return selo;
}

// Pinta de verde o item aberto no detalhe (e tira dos outros)
export function marcarSelecionado(codigo) {
    for (const item of document.querySelectorAll('.item-fila')) {
        item.classList.toggle('selecionado', item.dataset.codigo === codigo);
    }
}