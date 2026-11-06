// =============================================================
// visao-os.js: a tela "Ordens de Serviço" (abertas e encerradas)
// =============================================================
import { estado } from './estado.js';
import { montarOrdens, andamentoPorTalhao, SITUACOES } from './ordens.js';
import { responsavelDaOS } from './analistas.js';
import { bloco, campo } from './detalhe.js';
import { criar, formatarHa, formatarPeriodo, dataCurta, lerDataBR, lerTalhoes, lerEquipamentos, numeroBR, semAcento, NOMES_DOS_TIPOS, redesenhar } from './util.js';

// Como a situação de um apontamento aparece na ficha
const SITUACAO_DO_APONTAMENTO = {
    'OS Lançada': 'lançado', 'Em análise': 'em análise', 'Rejeitado': 'rejeitado',
    'Cancelado pelo líder': 'cancelado pelo líder', 'Cancelado pelo controle': 'cancelado pelo controle'
};

let visaoAtual = 'solicitacoes';

// Ordem da lista em cada aba (o botão no topo da lista): 'antiga' ou 'recente'
const ordemOS = { abertas: 'antiga', encerradas: 'recente', todas: 'recente' };
const CHAVE_ORDEM_OS = 'gestao_os_ordem_os';
try {
    Object.assign(ordemOS, JSON.parse(localStorage.getItem(CHAVE_ORDEM_OS)) || {});
} catch (erro) { /* sem acesso: fica a ordem padrão */ }
let abaOS = 'abertas';
let osEscolhida = null;   // codigoTemp da abertura que está na ficha
const detalhesAbertos = new Set();   // apontamentos com os detalhes abertos (para não fecharem quando a tela redesenha)

// ---------- Trocar entre Solicitações e Ordens de Serviço ----------
function mudarVisao(nova) {
    visaoAtual = nova;
    for (const botao of document.querySelectorAll('.visao-botao')) {
        botao.classList.toggle('ativo', botao.dataset.visao === nova);
    }
    document.getElementById('visao-solicitacoes').hidden = nova !== 'solicitacoes';
    document.getElementById('visao-os').hidden = nova !== 'os';
    if (nova === 'os') desenharVisaoOS();
}

// ---------- A tela inteira ----------
function desenharVisaoOS() {
    const ordens = montarOrdens(estado.lista).filter(aparece);

    const abertas = ordens.filter(o => o.situacao !== 'encerrada');
    const encerradas = ordens.filter(o => o.situacao === 'encerrada');
    document.getElementById('cont-os-abertas').textContent = abertas.length;
    document.getElementById('cont-os-encerradas').textContent = encerradas.length;
    document.getElementById('cont-os-todas').textContent = ordens.length;

    const daAba = { abertas, encerradas, todas: ordens }[abaOS];

    // Abertas: pela data em que a OS foi pedida · Encerradas e Todas: pelo último movimento
    const dataDe = abaOS === 'abertas' ? (o => o.abertura.dataSincronizacao) : (o => o.ultimaData);
    const sentido = ordemOS[abaOS] === 'antiga' ? 1 : -1;
    daAba.sort((a, b) => sentido * (lerDataBR(dataDe(a)) - lerDataBR(dataDe(b))));

    document.getElementById('os-ordem').textContent =
        ordemOS[abaOS] === 'antiga' ? 'mais antiga primeiro' : 'mais recente primeiro';

    desenharLista(daAba);

    const escolhida = ordens.find(o => o.abertura.codigoTemp === osEscolhida);
    if (escolhida) {
        desenharFicha(escolhida);
    } else {
        document.getElementById('os-ficha').replaceChildren(
            criar('p', 'vazio', 'Escolha uma OS na lista para ver o andamento.')
        );
    }
}

// Os mesmos filtros do topo: "Ver OS de" e a busca
function aparece(ordem) {
    const os = ordem.abertura;
    const responsavel = responsavelDaOS(os);
    if (estado.verOSde.size > 0 && responsavel && !estado.verOSde.has(responsavel.id)) return false;

    if (estado.busca) {
        const ondeProcurar = semAcento([
            os.codigoOS, os.fa_codigo, os.descricao_fazenda, os.operacao, os.solicitante_nome, responsavel?.nome
        ].join(' '));
        if (!ondeProcurar.includes(estado.busca)) return false;
    }
    return true;
}

// ---------- A lista (coluna da esquerda) ----------
function desenharLista(ordens) {
    // Mesma aba, ordem e filtros = é só uma atualização (ou um clique): a rolagem fica onde estava
    const chave = [abaOS, ordemOS[abaOS], estado.busca, [...estado.verOSde]].join('|');
    const itens = ordens.length > 0 ? ordens.map(itemDaOS) : [criar('p', 'fila-vazia', 'Nenhuma OS por aqui.')];
    redesenhar(document.getElementById('os-lista'), chave, itens);
}

function itemDaOS(ordem) {
    const os = ordem.abertura;
    const item = criar('button', 'item-fila');
    item.type = 'button';
    item.dataset.codigo = os.codigoTemp;
    if (os.codigoTemp === osEscolhida) item.classList.add('selecionado');

    const topo = criar('span', 'item-topo');
    topo.append(seloSituacao(ordem.situacao), criar('span', 'item-pct', ordem.pct + '%'));

    item.append(
        topo,
        criar('span', 'item-titulo', numeroDaOS(os)),
        criar('span', 'item-fazenda', [os.fa_codigo, os.descricao_fazenda].filter(Boolean).join(' · ')),
        criar('span', 'item-info', [os.operacao, os.solicitante_nome].filter(Boolean).join(' · ')),
        barraAndamento(ordem.pct)
    );
    return item;
}

// "11038;11039" → "OS 11038 · 11039"
function numeroDaOS(os) {
    const numeros = String(os.codigoOS).split(';').map(n => n.trim()).filter(Boolean);
    return 'OS ' + numeros.join(' · ');
}

function seloSituacao(situacao) {
    const selo = criar('span', 'situacao-os', SITUACOES[situacao]);
    selo.dataset.situacao = situacao;
    return selo;
}

function barraAndamento(pct) {
    const barra = criar('span', 'barra-andamento');
    const feito = criar('span', 'barra-feito');
    feito.style.width = pct + '%';
    barra.append(feito);
    return barra;
}

// ---------- A ficha (coluna do meio) ----------
function desenharFicha(ordem) {
    // A mesma OS redesenhada (atualização) fica onde estava; outra OS começa do topo
    redesenhar(document.getElementById('os-ficha'), ordem.abertura.codigoTemp, [
        cabecalhoDaFicha(ordem),
        blocoAndamento(ordem),
        blocoApontamentos(ordem)
    ]);
}

function cabecalhoDaFicha(ordem) {
    const os = ordem.abertura;
    const selos = criar('div', 'detalhe-selos');
    selos.append(seloSituacao(ordem.situacao));

    const caixa = criar('div', 'cartao detalhe-cabecalho');
    caixa.append(
        selos,
        criar('h1', 'detalhe-titulo', numeroDaOS(os)),
        criar('p', 'detalhe-quem', [os.fa_codigo, os.descricao_fazenda, os.operacao].filter(Boolean).join(' · ')),
        criar('p', 'detalhe-quem',
            `Líder ${os.solicitante_nome} · pedida em ${os.dataSincronizacao} · previsão ${formatarPeriodo(os.data_prevista_inicio, os.data_prevista_fim)}`)
    );

    if (os.pdf_url) {
        const pdf = criar('a', 'link-botao', 'Abrir o PDF da OS');
        pdf.href = os.pdf_url;
        pdf.target = '_blank';
        pdf.rel = 'noopener';
        caixa.append(pdf);
    }
    return caixa;
}

function blocoAndamento(ordem) {
    const resumo = criar('p', 'andamento-resumo');
    resumo.append(
        criar('strong', '', ordem.pct + '%'),
        `executado · ${formatarHa(ordem.areaFeita)} de ${formatarHa(ordem.areaPrevista)}`
    );

    const conteudo = criar('div', 'andamento');
    conteudo.append(resumo, barraAndamento(ordem.pct));

    const talhoes = andamentoPorTalhao(ordem);
    if (talhoes.length > 0) conteudo.append(tabelaTalhoes(talhoes));

    return bloco('Andamento', conteudo, `${ordem.lancados} de ${ordem.apontamentos.length} apontamentos lançados`);
}

function tabelaTalhoes(talhoes) {
    const tabela = criar('table', 'tabela');
    const titulos = criar('tr');
    titulos.append(
        criar('th', '', 'Talhão'),
        criar('th', 'numero', 'Previsto'),
        criar('th', 'numero', 'Apontado'),
        criar('th', 'numero', '%')
    );
    tabela.append(titulos);

    for (const t of talhoes) {
        const pct = t.previsto > 0 ? Math.round(t.feito / t.previsto * 100) : 0;
        const linha = criar('tr');
        linha.append(
            criar('td', '', t.numero),
            criar('td', 'numero', formatarHa(t.previsto)),
            criar('td', 'numero', formatarHa(t.feito)),
            criar('td', 'numero', pct + '%')
        );
        tabela.append(linha);
    }

    const rolagem = criar('div', 'tabela-rolagem');
    rolagem.append(tabela);
    return rolagem;
}

function blocoApontamentos(ordem) {
    if (ordem.apontamentos.length === 0) {
        return bloco('Apontamentos', criar('p', 'bloco-vazio', 'Nenhum apontamento ainda.'));
    }
    const lista = criar('ol', 'linha-do-tempo');
    lista.append(...ordem.apontamentos.map(itemApontamento));
    return bloco('Apontamentos', lista, String(ordem.apontamentos.length));
}

function itemApontamento(a) {
    const item = criar('li', 'evento');
    item.dataset.status = a.status_aprovacao;

    const talhoes = lerTalhoes(a.talhoes).map(t => t.numero).join(', ');
    const detalhe = [
        a.data_prevista_inicio ? 'executado em ' + dataCurta(a.data_prevista_inicio) : '',
        talhoes ? 'talhões ' + talhoes : ''
    ].filter(Boolean).join(' · ');

    item.append(
        criar('strong', '', `${NOMES_DOS_TIPOS[a.tipo_registro]} · ${formatarHa(a.area_total)} · ${SITUACAO_DO_APONTAMENTO[a.status_aprovacao] || a.status_aprovacao}`),
        criar('span', '', `${a.solicitante_nome} · enviado em ${a.dataSincronizacao}`)
    );
    if (detalhe) item.append(criar('span', 'evento-detalhe', detalhe));
    if ((a.status_aprovacao === 'Rejeitado' || a.status_aprovacao === 'Cancelado pelo controle') && a.justificativa_controle) {
        item.append(criar('span', 'evento-detalhe', 'Motivo: ' + a.justificativa_controle));
    }

    item.append(detalhesDoApontamento(a));
    return item;
}
const UMA_HORA = 60 * 60 * 1000;   // em milissegundos
// "23/10/2026, 09:14:05" → "23/10/2026 09:14" (o app grava com vírgula e segundos)
function dataHora(texto) {
    return String(texto ?? '').replace(',', '').replace(/(\d{1,2}:\d{2}):\d{2}/, '$1').trim();
}

// "Detalhes": abre e fecha ali mesmo, embaixo do apontamento, sem sair da tela
function detalhesDoApontamento(a) {
    const caixa = criar('details', 'apontamento-detalhes');
    caixa.open = detalhesAbertos.has(a.codigoTemp);
    caixa.addEventListener('toggle', () => {
        if (caixa.open) detalhesAbertos.add(a.codigoTemp);
        else detalhesAbertos.delete(a.codigoTemp);
    });

    const campos = criar('dl', 'campos');
    // Só quando o líder registrou bem antes de chegar na planilha (ficou sem sinal): aí a diferença importa
    const registrado = dataHora(a.data_solicitacao);
    const horasDeAtraso = Math.round((lerDataBR(a.dataSincronizacao) - lerDataBR(registrado)) / UMA_HORA);
    if (registrado && horasDeAtraso >= 1) {
        campo(campos, 'Registrado em', `${registrado} · chegou ${horasDeAtraso} h depois`);
    }
    campo(campos, 'Executado', formatarPeriodo(a.data_prevista_inicio, a.data_prevista_fim));
    campo(campos, 'Talhões', lerTalhoes(a.talhoes).map(t => `${t.numero} (${formatarHa(t.area)})`).join(' · '));
    campo(campos, 'Equipamentos', lerEquipamentos(a.equipamentos).map(e => e.nome).join(' · '));
    campo(campos, 'Insumos', (a.produtos || [])
        .map(p => `${p.cod} ${p.desc} · dose ${numeroBR(p.dose)} · total ${numeroBR(p.total)} ${p.un}`)
        .join('\n'));
    campo(campos, 'Observação', a.observacao);

    const links = criar('div', 'apontamento-links');
    const abrir = criar('button', 'link-botao', 'Abrir em Solicitações');
    abrir.type = 'button';
    abrir.dataset.abrir = a.codigoTemp;
    links.append(abrir);
    if (a.pdf_url) {
        const pdf = criar('a', 'link-botao', 'Abrir o PDF');
        pdf.href = a.pdf_url;
        pdf.target = '_blank';
        pdf.rel = 'noopener';
        links.append(pdf);
    }

    const conteudo = criar('div', 'apontamento-conteudo');
    conteudo.append(campos, links);
    caixa.append(criar('summary', '', 'Detalhes'), conteudo);
    return caixa;
}

// ---------- Ligar os botões e os avisos ----------
export function iniciarVisaoOS() {
    document.querySelector('.visoes').addEventListener('click', evento => {
        const botao = evento.target.closest('.visao-botao');
        if (botao) mudarVisao(botao.dataset.visao);
    });

    document.getElementById('abas-os').addEventListener('click', evento => {
        const botao = evento.target.closest('.aba');
        if (!botao) return;
        abaOS = botao.dataset.aba;
        for (const aba of document.querySelectorAll('#abas-os .aba')) {
            aba.classList.toggle('ativa', aba === botao);
        }
        desenharVisaoOS();
    });
    document.getElementById('os-ordem').addEventListener('click', () => {
        ordemOS[abaOS] = ordemOS[abaOS] === 'antiga' ? 'recente' : 'antiga';
        try { localStorage.setItem(CHAVE_ORDEM_OS, JSON.stringify(ordemOS)); } catch (erro) { /* só não guarda */ }
        desenharVisaoOS();
    });
    document.getElementById('os-lista').addEventListener('click', evento => {
        const item = evento.target.closest('.item-fila');
        if (!item) return;
        osEscolhida = item.dataset.codigo;
        desenharVisaoOS();
    });

    // "Ver a solicitação": abre o apontamento na tela de Solicitações
    document.getElementById('os-ficha').addEventListener('click', evento => {
        const botao = evento.target.closest('[data-abrir]');
        if (botao) document.dispatchEvent(new CustomEvent('abrir-os', { detail: botao.dataset.abrir }));
    });

    // Alguém pediu para abrir uma solicitação (este botão ou a notificação): volta para Solicitações
    document.addEventListener('abrir-os', () => mudarVisao('solicitacoes'));

    // A lista chegou, uma OS mudou, o "Ver OS de" mudou ou digitaram na busca: redesenha
    const redesenhar = () => { if (visaoAtual === 'os') desenharVisaoOS(); };
    document.addEventListener('lista-atualizada', redesenhar);
    document.addEventListener('os-mudou', redesenhar);
    document.addEventListener('analistas-mudou', redesenhar);
    document.getElementById('busca').addEventListener('input', redesenhar);
}
