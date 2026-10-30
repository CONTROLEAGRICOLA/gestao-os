// =============================================================
// edicao-talhoes.js: a lista de talhões dentro da edição
// =============================================================
import { criar, lerTalhoes, formatarHa, numeroBR } from './util.js';

const form = document.getElementById('form-editar');
const caixa = document.getElementById('editar-talhoes');
const campoNovo = document.getElementById('editar-novo-talhao');
const aviso = document.getElementById('editar-talhoes-aviso');

let fazendas = [];   // todas as fazendas, cada uma com seus talhões (vem do 'init')

// ---------- Preencher com os talhões da OS ----------
export function preencherTalhoes(texto, listaDeFazendas) {
    fazendas = listaDeFazendas;
    aviso.textContent = '';
    campoNovo.value = '';
    caixa.replaceChildren(...lerTalhoes(texto).map(t => linhaDoTalhao(t.numero, t.area)));
}

function linhaDoTalhao(numero, area) {
    const linha = criar('div', 'linha-edicao');
    linha.dataset.numero = numero;

    const campo = criar('input', 'talhao-area');
    campo.type = 'number';
    campo.step = '0.01';
    campo.min = '0';
    campo.value = area;

    const remover = criar('button', 'botao-remover', '×');
    remover.type = 'button';
    remover.title = 'Tirar este talhão';

    linha.append(
        criar('strong', '', 'Talhão ' + numero),
        campo,
        criar('span', 'dica talhao-maximo', textoDoMaximo(numero)),
        remover
    );
    marcarExcesso(linha);
    return linha;
}

// Linha vermelha na hora em que a área passa do máximo da base
function marcarExcesso(linha) {
    const maximo = areaNaBase(linha.dataset.numero);
    const area = Number(linha.querySelector('.talhao-area').value) || 0;
    linha.classList.toggle('acima', maximo !== null && area > maximo + 0.005);
}

// ---------- A base (aba TALHAO) ----------

// A fazenda escolhida AGORA no formulário (o analista pode ter trocado)
function fazendaEscolhida() {
    const texto = form.elements.fazenda.value.trim();
    return fazendas.find(f => f.descricao === texto) || null;
}

// Área do talhão na base. null = a fazenda não tem esse talhão (ou a fazenda não está na base)
function areaNaBase(numero) {
    const fazenda = fazendaEscolhida();
    if (!fazenda) return null;
    const talhao = fazenda.talhoes.find(t => parseInt(t.talhao, 10) === parseInt(numero, 10));
    return talhao ? Number(talhao.area) || 0 : null;
}

function textoDoMaximo(numero) {
    if (!fazendaEscolhida()) return 'ha';
    const maximo = areaNaBase(numero);
    return maximo === null ? 'ha · não existe nesta fazenda' : `ha · máx. ${numeroBR(maximo)}`;
}

// ---------- O que o resto da edição usa ----------

// Formato da planilha (igual ao app): "1:16.13ha, 2:20.00ha"
export function textoDosTalhoes() {
    return [...caixa.querySelectorAll('.linha-edicao')]
        .map(linha => {
            const area = Number(linha.querySelector('.talhao-area').value) || 0;
            return `${linha.dataset.numero}:${area.toFixed(2)}ha`;
        })
        .join(', ');
}

// Devolve o problema, ou '' se está tudo certo
export function conferirTalhoes() {
    const linhas = [...caixa.querySelectorAll('.linha-edicao')];
    if (linhas.length === 0) return 'Deixe pelo menos um talhão.';

    const fazenda = fazendaEscolhida();
    for (const linha of linhas) {
        const numero = linha.dataset.numero;
        const area = Number(linha.querySelector('.talhao-area').value) || 0;
        if (area <= 0) return `Talhão ${numero}: a área precisa ser maior que zero.`;

        if (!fazenda) continue;   // fazenda fora da base: não dá para conferir
        const maximo = areaNaBase(numero);
        if (maximo === null) return `O talhão ${numero} não existe na fazenda ${fazenda.nome}.`;
        if (area > maximo + 0.005) {
            return `Talhão ${numero}: ${numeroBR(area)} ha é mais que a área dele na base (${formatarHa(maximo)}).`;
        }
    }
    return '';
}

// ---------- Área total = soma dos talhões ----------
function atualizarArea() {
    let soma = 0;
    for (const campo of caixa.querySelectorAll('.talhao-area')) soma += Number(campo.value) || 0;

    const area = form.elements.area_total;
    area.value = soma.toFixed(2);
    area.dispatchEvent(new Event('input'));   // avisa quem depende da área (os insumos)
}

// ---------- Adicionar talhões ("1-4, 8", igual ao app) ----------
function expandirIntervalos(texto) {
    const numeros = new Set();
    for (const pedaco of texto.split(',')) {
        const [de, ate] = pedaco.split('-').map(x => parseInt(x, 10));
        if (isNaN(de)) continue;
        const fim = isNaN(ate) ? de : ate;
        if (Math.abs(fim - de) > 500) continue;   // intervalo grande demais: provavelmente erro de digitação
        for (let n = Math.min(de, fim); n <= Math.max(de, fim); n++) numeros.add(n);
    }
    return [...numeros];
}

function adicionarTalhoes() {
    const fazenda = fazendaEscolhida();
    const jaTem = new Set([...caixa.querySelectorAll('.linha-edicao')].map(l => parseInt(l.dataset.numero, 10)));
    const naoExistem = [];

    for (const numero of expandirIntervalos(campoNovo.value)) {
        if (jaTem.has(numero)) continue;
        const area = areaNaBase(numero);
        if (fazenda && area === null) {
            naoExistem.push(numero);
            continue;
        }
        caixa.append(linhaDoTalhao(String(numero), area ?? 0));
        jaTem.add(numero);
    }

    aviso.textContent = naoExistem.length ? `Não existem nesta fazenda: ${naoExistem.join(', ')}` : '';
    campoNovo.value = '';
    atualizarArea();
}

// ---------- Eventos ----------
caixa.addEventListener('input', evento => {
    if (!evento.target.classList.contains('talhao-area')) return;
    marcarExcesso(evento.target.closest('.linha-edicao'));
    atualizarArea();
});

caixa.addEventListener('click', evento => {
    const botao = evento.target.closest('.botao-remover');
    if (!botao) return;
    botao.closest('.linha-edicao').remove();
    atualizarArea();
});

document.getElementById('editar-add-talhao').addEventListener('click', adicionarTalhoes);

campoNovo.addEventListener('keydown', evento => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();   // Enter dentro de um <form> enviaria o formulário
    adicionarTalhoes();
});

// Trocou a fazenda: atualiza o "máx." de cada talhão
form.elements.fazenda.addEventListener('change', () => {
    for (const linha of caixa.querySelectorAll('.linha-edicao')) {
        linha.querySelector('.talhao-maximo').textContent = textoDoMaximo(linha.dataset.numero);
        marcarExcesso(linha);
    }
});