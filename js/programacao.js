// =============================================================
// programacao.js: subir a programação da semana (toda quinta), pelo painel.
// O .xlsx é lido aqui no navegador (ler-xlsx.js) e conferido com as listas do app;
// o servidor só guarda. O envio novo substitui o anterior.
// Quem vê cada ordem vem da aba LIDER X OPERACAO da planilha (aqui só mostra).
// =============================================================
import { enviarProgramacao, infoProgramacao, buscarListas } from './api.js';
import { quemSouEu } from './usuario.js';
import { criar, mostrarAviso, formatarHa } from './util.js';
import { lerXlsx } from './ler-xlsx.js';

const dialogo = document.getElementById('dialogo-programacao');
const entrada = document.getElementById('programacao-arquivo');
const atual = document.getElementById('programacao-atual');
const resumo = document.getElementById('programacao-resumo');
const erro = document.getElementById('programacao-erro');
const botaoEnviar = document.getElementById('programacao-enviar');

// A aba do arquivo que tem a programação (nome sem acento, em maiúsculas)
const ABA = 'RECOMENDACOES LINHA A LINHA';

// Colunas dessa aba (nome no .xlsx, sem acento → nome que vai para o servidor); as outras são ignoradas
const COLUNAS = {
    'SEQ': 'SEQ', 'OPERACAO': 'OPERACAO', 'DESCRICAO OPERACAO': 'DESCRICAO_OPERACAO',
    'CENTRO DE CUSTO': 'CENTRO_CUSTO', 'F.A': 'FA', 'DESCRICAO FAZENDA': 'FAZENDA', 'TALHAO': 'TALHAO',
    'AREA A REALIZAR': 'AREA', 'COD INSUMO': 'COD_INSUMO', 'INSUMO': 'INSUMO', 'DOSE': 'DOSE',
    'UNIDADE': 'UNIDADE', 'FORA DA FAIXA': 'FORA_DA_FAIXA'
};
const OPCIONAIS = ['FORA DA FAIXA'];   // se faltar, vai vazio

let linhas = [];    // o que vai para o servidor (uma por operação × fazenda × talhão × insumo)
let lideres = null; // { '1046': ['AIRTON ...', ...] } da aba LIDER X OPERACAO (null = não deu para ver)
let listas = null;  // fazendas, operações e insumos do app (para conferir)
let carregando = null;  // a busca acima; o arquivo espera ela terminar antes de conferir

// "Área a realizar" → "AREA A REALIZAR"
function normal(texto) {
    return String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

// ---------- Abrir ----------
async function abrir() {
    if (!quemSouEu()) {
        mostrarAviso('Escolha quem é você em "Usuário" antes de subir a programação.', 'alerta');
        return;
    }
    limpar();
    dialogo.showModal();
    carregando = carregar();
}

// O que está valendo, quem faz cada operação e as listas do app
async function carregar() {
    atual.textContent = 'Vendo qual foi a ultima programação enviada…';
    try {
        const info = await infoProgramacao();
        lideres = info.lideres || null;
        atual.textContent = info.enviadaEm
            ? `Ultima programação: enviada em ${new Date(info.enviadaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} por ${info.enviadaPor || '—'} (${info.linhas} linhas).`
            : 'Ainda não tem nenhuma programação enviada.';
    } catch (falha) {
        atual.textContent = '';
        lideres = null;
    }
    try {
        if (!listas) listas = await buscarListas();
    } catch (falha) {
        listas = null;   // sem as listas, só não confere fazenda/operação/insumo
    }
}

function limpar() {
    linhas = [];
    entrada.value = '';
    resumo.replaceChildren();
    erro.textContent = '';
    botaoEnviar.disabled = true;
}

// ---------- Ler o arquivo ----------
async function lerArquivo(arquivo) {
    limpar();
    if (!/\.xlsx$/i.test(arquivo.name)) {
        erro.textContent = 'Escolha o arquivo .xlsx da programação.';
        return;
    }
    let abas;
    try {
        abas = await lerXlsx(arquivo);
    } catch (falha) {
        erro.textContent = 'Não deu para ler este arquivo. Ele é um .xlsx do Excel?';
        return;
    }

    const nomes = Object.keys(abas);
    const abaProg = nomes.find(n => normal(n) === ABA);
    if (!abaProg) {
        erro.textContent = 'Não achei a aba "RECOMENDAÇÕES LINHA A LINHA" no arquivo.';
        return;
    }

    // Cabeçalho: a primeira linha com "OPERAÇÃO" e "F.A"
    const tabela = abas[abaProg];
    const iCab = tabela.findIndex(l => l.map(normal).includes('OPERACAO') && l.map(normal).includes('F.A'));
    const cab = iCab === -1 ? [] : tabela[iCab].map(normal);
    const faltam = Object.keys(COLUNAS).filter(c => !cab.includes(c) && !OPCIONAIS.includes(c));
    if (faltam.length > 0) {
        erro.textContent = 'Faltam colunas na aba "' + abaProg + '": ' + faltam.join(', ') + '.';
        return;
    }

    linhas = tabela.slice(iCab + 1)
        .filter(l => l[cab.indexOf('OPERACAO')] !== '' && l[cab.indexOf('F.A')] !== '' && l[cab.indexOf('TALHAO')] !== '')
        .map(l => {
            const linha = {};
            for (const [coluna, chave] of Object.entries(COLUNAS)) {
                const i = cab.indexOf(coluna);
                linha[chave] = i === -1 ? '' : (l[i] ?? '');   // célula vazia no fim da linha não existe: vira ''
            }
            return linha;
        });
    if (linhas.length === 0) {
        erro.textContent = 'A aba "' + abaProg + '" está vazia.';
        return;
    }

    await carregando;   // se escolheu o arquivo rápido, espera chegar quem faz cada operação
    desenharResumo(arquivo.name, conferir());
    botaoEnviar.disabled = false;
}

// ---------- Conferir com as listas do app (só avisa, não impede) ----------
function conferir() {
    const avisos = new Set();
    const ops = [...new Set(linhas.map(l => String(l.OPERACAO)))];

    if (!lideres) {
        avisos.add('Não deu para ver a aba LIDER X OPERACAO agora: confira na planilha quem faz cada operação.');
    } else {
        for (const op of ops) {
            if (!lideres[op]) avisos.add(`Operação ${op}: ninguém na aba LIDER X OPERACAO (nenhum líder vai ver essas ordens).`);
        }
    }
    if (!listas) return [...avisos];

    for (const l of linhas) {
        const faz = listas.fazendas.find(f => String(f.codigo) === String(l.FA));
        if (!faz) {
            avisos.add(`Fazenda ${l.FA} (${l.FAZENDA}) não está no cadastro de talhões: o líder vai ter que escolher a fazenda à mão.`);
        } else if (!faz.talhoes.some(t => String(t.talhao) === String(l.TALHAO))) {
            avisos.add(`Talhão ${l.TALHAO} da fazenda ${l.FA} não está no cadastro de talhões.`);
        }
        const temOp = listas.operacoes.some(o => String(o.operacao).startsWith(l.OPERACAO + '-')
            && String(o.centroCusto).startsWith(l.CENTRO_CUSTO + '-'));
        if (!temOp) avisos.add(`Operação ${l.OPERACAO} no centro de custo ${l.CENTRO_CUSTO} não está na lista de atividades.`);
        if (l.COD_INSUMO !== '' && !listas.insumos.some(i => String(i.cod) === String(l.COD_INSUMO))) {
            avisos.add(`Insumo ${l.COD_INSUMO} (${l.INSUMO}) não está no cadastro de insumos.`);
        }
    }
    return [...avisos];
}

// Os nomes de quem faz a operação (aba LIDER X OPERACAO)
function quemFaz(operacao) {
    return (lideres && lideres[String(operacao)]) || [];
}

// ---------- Resumo: o que o arquivo tem ----------
function desenharResumo(nomeArquivo, avisos) {
    // Ordem = operação + fazenda + centro de custo (igual ao app): a mesma fazenda pode ter
    // talhões em centros de custo diferentes, e cada OS tem um centro de custo só
    const ordens = new Map();
    for (const l of linhas) {
        const chave = l.OPERACAO + '|' + l.FA + '|' + l.CENTRO_CUSTO;
        if (!ordens.has(chave)) ordens.set(chave, { l, talhoes: new Map() });
        ordens.get(chave).talhoes.set(String(l.TALHAO), Number(l.AREA) || 0);
    }
    const fazendas = new Set(linhas.map(l => l.FA)).size;
    const operacoes = new Set(linhas.map(l => l.OPERACAO)).size;
    const quantosLideres = new Set([...new Set(linhas.map(l => l.OPERACAO))].flatMap(quemFaz)).size;

    const titulo = criar('p', 'programacao-titulo');
    const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
    titulo.append(criar('strong', '', nomeArquivo),
        ` · ${plural(ordens.size, 'ordem', 'ordens')} · ${plural(operacoes, 'operação', 'operações')} · ${plural(fazendas, 'fazenda', 'fazendas')}`
        + (quantosLideres ? ` · ${plural(quantosLideres, 'líder', 'líderes')}` : ''));

    const tabela = criar('div', 'programacao-ordens');
    for (const { l, talhoes } of ordens.values()) {
        const quem = quemFaz(l.OPERACAO);
        const area = [...talhoes.values()].reduce((s, a) => s + a, 0);
        const linha = criar('div', 'programacao-ordem');
        linha.append(
            criar('span', 'programacao-op', `${l.SEQ}ª · ${l.OPERACAO}`),
            criar('span', 'programacao-faz', l.FAZENDA),
            criar('span', '', `CC ${l.CENTRO_CUSTO} · ${talhoes.size === 1 ? 'Talhão' : 'Talhões'} ${[...talhoes.keys()].join(', ')} · ${formatarHa(area)}`),
            criar('span', 'programacao-quem', quem.length ? quem.slice(0, 2).join(', ') + (quem.length > 2 ? ` +${quem.length - 2}` : '') : '—')
        );
        linha.lastChild.title = quem.join(', ');   // o nome inteiro de todos, com o mouse em cima
        tabela.append(linha);
    }

    resumo.replaceChildren(titulo, tabela);
    if (avisos.length > 0) {
        const lista = criar('ul', 'programacao-avisos');
        for (const a of avisos) lista.append(criar('li', '', a));
        resumo.append(criar('p', 'programacao-avisos-titulo', `⚠️ ${avisos.length === 1 ? '1 aviso' : avisos.length + ' avisos'} (dá para enviar mesmo assim):`), lista);
    }
}

// ---------- Enviar ----------
async function enviar() {
    const eu = quemSouEu();
    if (!eu || linhas.length === 0) return;
    botaoEnviar.disabled = true;
    botaoEnviar.textContent = 'Enviando…';
    erro.textContent = '';
    try {
        await enviarProgramacao(linhas, eu.nome);
        dialogo.close();
        mostrarAviso('Programação enviada. Os líderes já veem as ordens no app.');
    } catch (falha) {
        erro.textContent = 'Não enviou: ' + falha.message;
        botaoEnviar.disabled = false;
    } finally {
        botaoEnviar.textContent = 'Enviar programação';
    }
}

// ---------- Botões ----------
document.getElementById('btn-programacao').addEventListener('click', abrir);
document.getElementById('programacao-fechar').addEventListener('click', () => dialogo.close());
entrada.addEventListener('change', () => { if (entrada.files[0]) lerArquivo(entrada.files[0]); });
botaoEnviar.addEventListener('click', enviar);