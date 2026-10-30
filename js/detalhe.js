// =============================================================
// detalhe.js: desenha a coluna do meio (a OS escolhida)
// =============================================================
import {
    criar, tempoDeEspera, formatarHa, formatarPeriodo, tituloDaOS, NOMES_DOS_TIPOS,
    numeroBR, lerTalhoes, lerEquipamentos, redesenhar
} from './util.js';

import { responsavelDaOS } from './analistas.js';

export function desenharDetalhe(os) {
    const cartoes = criar('div', 'grade-cartoes');
    cartoes.append(cartaoOnde(os), cartaoOQue(os));

    const partes = [
        cabecalho(os),
        cartoes,
        blocoTalhoes(os),
        blocoEquipamentos(os),
        blocoInsumos(os),
        blocoObservacao(os)
    ];
    // A mesma OS redesenhada (atualização) fica onde estava; outra OS começa do topo
    redesenhar(document.getElementById('detalhe'), os.codigoTemp, partes.filter(Boolean));
}
function cabecalho(os) {
    const selos = criar('div', 'detalhe-selos');

    const tag = criar('span', 'tag', NOMES_DOS_TIPOS[os.tipo_registro] || os.tipo_registro);
    tag.dataset.tipo = os.tipo_registro;
    const status = criar('span', 'status-os', os.status_aprovacao);
    status.dataset.status = os.status_aprovacao;
    selos.append(tag, status);

    if (os.status_aprovacao === 'Em análise') {
        const espera = tempoDeEspera(os.dataSincronizacao);
        selos.append(criar('span', 'espera ' + espera.nivel, 'aguardando ' + espera.texto));

        const editar = criar('button', 'botao-editar', '✏️ Editar');
        editar.type = 'button';
        editar.id = 'btn-editar';
        selos.append(editar);

    }

    const quem = [os.solicitante_nome, os.dataSincronizacao].filter(Boolean).join(' · ');

    const caixa = criar('div', 'cartao detalhe-cabecalho');
    caixa.append(
        selos,
        criar('h1', 'detalhe-titulo', tituloDaOS(os)),
        criar('p', 'detalhe-quem', 'Pedida por ' + quem)
    );
    return caixa;
}

function cartaoOnde(os) {
    const campos = criar('dl', 'campos');
    campo(campos, 'Fazenda', [os.fa_codigo, os.descricao_fazenda].filter(Boolean).join(' · '));
    campo(campos, 'Tipo', os.tipo_fazenda);
    campo(campos, 'Período previsto', formatarPeriodo(os.data_prevista_inicio, os.data_prevista_fim));
    campo(campos, 'Programação', [os.programacao, os.carreador].filter(Boolean).join(' · '));
    campo(campos, 'PEA', os.pea);
    return bloco('Detalhes', campos);
}

function cartaoOQue(os) {
    const campos = criar('dl', 'campos');
    if (os.tipo_registro !== 'LANCAMENTO') {
        campo(campos, 'OS de origem', os.numero_origem ? `OS ${os.numero_origem}` : `sem nº (${os.os_origem})`);
    }
    campo(campos, 'Centro de custo', os.centro_custo);
    campo(campos, 'Operação', os.operacao);
    campo(campos, 'Área total', os.area_total ? formatarHa(os.area_total) : '');
    return bloco('Serviço', campos);
}

// Um cartão branco com título pequeno em cima
function blocoTalhoes(os) {
    const talhoes = lerTalhoes(os.talhoes);
    if (talhoes.length === 0) {
        return bloco('Talhões', criar('p', 'bloco-vazio', 'Nenhum talhão informado.'));
    }

    const grade = criar('div', 'talhoes');
    let soma = 0;
    for (const t of talhoes) {
        const cartao = criar('div', 'talhao');
        cartao.append(
            criar('strong', '', t.numero),
            criar('span', '', t.area ? formatarHa(t.area) : '—')
        );
        grade.append(cartao);
        soma += t.area;
    }

    const palavra = talhoes.length === 1 ? 'talhão' : 'talhões';
    return bloco('Talhões', grade, `${talhoes.length} ${palavra} · ${formatarHa(soma)}`);
}

function blocoEquipamentos(os) {
    const equipamentos = lerEquipamentos(os.equipamentos);
    if (equipamentos.length === 0) return null;

    const lista = criar('ul', 'equipamentos');
    for (const eq of equipamentos) {
        const item = criar('li');
        item.append(criar('strong', '', eq.nome));
        if (eq.cc) item.append(criar('span', '', eq.cc));
        lista.append(item);
    }
    return bloco('Equipamentos', lista, String(equipamentos.length));
}

function blocoInsumos(os) {
    const produtos = os.produtos || [];
    if (produtos.length === 0) {
        return bloco('Insumos', criar('p', 'bloco-vazio', 'Nenhum insumo nesta solicitação.'));
    }

    const tabela = criar('table', 'tabela');
    const titulos = criar('tr');
    titulos.append(
        criar('th', '', 'Produto'),
        criar('th', '', 'Un'),
        criar('th', 'numero', 'Dose'),
        criar('th', 'numero', 'Total')
    );
    tabela.append(titulos);

    for (const p of produtos) {
        const linha = criar('tr');
        linha.append(
            criar('td', '', [p.cod, p.desc].filter(Boolean).join(' · ')),
            criar('td', '', p.un),
            criar('td', 'numero', numeroBR(p.dose)),
            criar('td', 'numero', numeroBR(p.total))
        );
        tabela.append(linha);
    }

    const rolagem = criar('div', 'tabela-rolagem');
    rolagem.append(tabela);
    const palavra = produtos.length === 1 ? 'produto' : 'produtos';
    return bloco('Insumos', rolagem, `${produtos.length} ${palavra}`);
}

function blocoObservacao(os) {
    const texto = String(os.observacao ?? '').trim();
    if (!texto || texto === '-') return null;
    return bloco('Observação do líder', criar('p', 'observacao', texto));
}

// Um cartão branco com título pequeno em cima (e um resumo opcional à direita)
export function bloco(titulo, conteudo, resumo) {
    const topo = criar('div', 'bloco-topo');
    topo.append(criar('h2', 'bloco-titulo', titulo));
    if (resumo) topo.append(criar('span', 'bloco-resumo', resumo));

    const caixa = criar('section', 'cartao bloco');
    caixa.append(topo, conteudo);
    return caixa;
}

// Uma linha "rótulo: valor" dentro de um <dl>
export function campo(lista, rotulo, valor) {
    const texto = String(valor ?? '').trim();
    const vazio = texto === '' || texto === '-';
    lista.append(
        criar('dt', '', rotulo),
        criar('dd', vazio ? 'nada' : '', vazio ? 'não informado' : texto)
    );
}

