// =============================================================
// edicao-insumos.js: os insumos (produtos) dentro da edição
// =============================================================
import { criar } from './util.js';

const form = document.getElementById('form-editar');
const caixa = document.getElementById('editar-insumos');

let insumos = [];                 // a lista do 'init': [{ cod, desc, un, min, max }]
let codigosOriginais = new Set(); // códigos que a OS já tinha (podem não estar mais na base)
let calculaTotal = true;          // abertura: total = dose × área · apontamento: dose = total ÷ área

// ---------- Preencher com os insumos da OS ----------
export function preencherInsumos(os, lista) {
    insumos = lista;
    calculaTotal = os.tipo_registro === 'LANCAMENTO';
    document.getElementById('lista-insumos').replaceChildren(
        ...lista.map(i => new Option(i.desc, i.cod))   // valor = código; a descrição aparece ao lado
    );

    const produtos = os.produtos || [];
    codigosOriginais = new Set(produtos.map(p => String(p.cod)));
    caixa.replaceChildren(...produtos.map(linhaDoInsumo));
}

function linhaDoInsumo(produto = {}) {
    const linha = criar('div', 'linha-edicao linha-insumo');

    const cod = criar('input', 'insumo-cod');
    cod.setAttribute('list', 'lista-insumos');
    cod.placeholder = 'Código';
    cod.autocomplete = 'off';
    cod.value = produto.cod || '';

    const dose = campoNumero('insumo-dose', '0.001', produto.dose);
    const total = campoNumero('insumo-total', '0.01', produto.total);
    dose.readOnly = !calculaTotal;   // abertura: digita a dose
    total.readOnly = calculaTotal;   // apontamento: digita o total

    const remover = criar('button', 'botao-remover', '×');
    remover.type = 'button';
    remover.title = 'Tirar este insumo';

    linha.append(
        cod,
        criar('span', 'insumo-desc', produto.desc || ''),
        criar('span', 'dica insumo-un', produto.un || ''),
        dose,
        total,
        remover
    );
    return linha;
}

function campoNumero(classe, passo, valor) {
    const campo = criar('input', classe);
    campo.type = 'number';
    campo.step = passo;
    campo.min = '0';
    campo.value = valor ?? '';
    return campo;
}

// ---------- Cálculos ----------

// Escolheu um código: mostra a descrição e a unidade da base
function mostrarProduto(linha) {
    const cod = linha.querySelector('.insumo-cod').value.trim();
    const achado = insumos.find(i => i.cod === cod);
    linha.querySelector('.insumo-desc').textContent = achado ? achado.desc : (cod ? 'código não encontrado' : '');
    linha.querySelector('.insumo-un').textContent = achado ? achado.un : '';
}

// A mesma conta do app
function recalcular(linha) {
    const area = Number(form.elements.area_total.value) || 0;
    const dose = linha.querySelector('.insumo-dose');
    const total = linha.querySelector('.insumo-total');
    if (calculaTotal) total.value = ((Number(dose.value) || 0) * area).toFixed(2);
    else dose.value = area > 0 ? ((Number(total.value) || 0) / area).toFixed(3) : '';
}
// ---------- O que o resto da edição usa ----------
export function lerInsumos() {
    return [...caixa.querySelectorAll('.linha-insumo')]
        .map(linha => ({
            cod: linha.querySelector('.insumo-cod').value.trim(),
            desc: linha.querySelector('.insumo-desc').textContent,
            un: linha.querySelector('.insumo-un').textContent,
            dose: linha.querySelector('.insumo-dose').value,
            total: linha.querySelector('.insumo-total').value
        }))
        .filter(p => p.cod);
}

// Um texto curto, só para saber se os insumos mudaram
export function resumoDosInsumos() {
    return lerInsumos().map(p => `${p.cod}|${p.dose}|${p.total}`).join(';');
}

export function conferirInsumos() {
    const vistos = new Set();
    for (const p of lerInsumos()) {
        const naBase = insumos.some(i => i.cod === p.cod);
        if (!naBase && !codigosOriginais.has(p.cod)) return `Insumo ${p.cod}: escolha um código da lista.`;
        if (vistos.has(p.cod)) return `O insumo ${p.cod} está repetido.`;
        vistos.add(p.cod);
        if (!(Number(p.dose) > 0) || !(Number(p.total) > 0)) return `Insumo ${p.cod}: preencha a dose e o total.`;
    }
    return '';
}

// ---------- Eventos ----------
caixa.addEventListener('input', evento => {
    const linha = evento.target.closest('.linha-insumo');
    if (!linha) return;
    if (evento.target.classList.contains('insumo-cod')) mostrarProduto(linha);
    else recalcular(linha);
});

caixa.addEventListener('click', evento => {
    const botao = evento.target.closest('.botao-remover');
    if (botao) botao.closest('.linha-insumo').remove();
});

document.getElementById('editar-add-insumo').addEventListener('click', () => {
    const linha = linhaDoInsumo();
    caixa.append(linha);
    linha.querySelector('.insumo-cod').focus();
});

// A área mudou (talhões): refaz a conta de todos os insumos
form.elements.area_total.addEventListener('input', () => {
    for (const linha of caixa.querySelectorAll('.linha-insumo')) recalcular(linha);
});