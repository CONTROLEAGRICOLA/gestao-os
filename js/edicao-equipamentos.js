// =============================================================
// edicao-equipamentos.js: a lista de equipamentos dentro da edição
// =============================================================
import { criar, lerEquipamentos } from './util.js';

const caixa = document.getElementById('editar-equipamentos');
const campoNovo = document.getElementById('editar-novo-equipamento');
const aviso = document.getElementById('editar-equipamentos-aviso');

let equipamentos = [];   // a lista do 'init': [{ nome, colB, propriedade }]

// ---------- Preencher com os equipamentos da OS ----------
export function preencherEquipamentos(texto, lista) {
    equipamentos = lista;
    document.getElementById('lista-equipamentos').replaceChildren(
        ...lista.map(e => new Option(e.colB, e.nome))   // valor = nome; o C.C. aparece ao lado, na sugestão
    );
    aviso.textContent = '';
    campoNovo.value = '';
    caixa.replaceChildren(...lerEquipamentos(texto).map(e => linhaDoEquipamento(e.nome, e.cc)));
}

function linhaDoEquipamento(nome, cc) {
    const linha = criar('div', 'linha-edicao');
    linha.dataset.nome = nome;
    linha.dataset.cc = cc;

    const remover = criar('button', 'botao-remover', '×');
    remover.type = 'button';
    remover.title = 'Tirar este equipamento';

    linha.append(criar('strong', '', nome), criar('span', 'dica', cc || 'sem C.C.'), remover);
    return linha;
}

// ---------- O que o resto da edição usa ----------

// Formato da planilha (igual ao app): "NOME [C.C.], NOME [C.C.]"
export function textoDosEquipamentos() {
    return [...caixa.querySelectorAll('.linha-edicao')]
        .map(linha => linha.dataset.cc ? `${linha.dataset.nome} [${linha.dataset.cc}]` : linha.dataset.nome)
        .join(', ');
}

export function conferirEquipamentos() {
    return caixa.children.length === 0 ? 'Deixe pelo menos um equipamento.' : '';
}

// ---------- Adicionar ----------
function adicionarEquipamento() {
    const nome = campoNovo.value.trim();
    if (!nome) return;

    const achado = equipamentos.find(e => e.nome === nome);
    const jaTem = [...caixa.querySelectorAll('.linha-edicao')].some(l => l.dataset.nome === nome);

    if (!achado) {
        aviso.textContent = 'Escolha o equipamento na lista de sugestões.';
    } else if (jaTem) {
        aviso.textContent = 'Esse equipamento já está na lista.';
    } else {
        caixa.append(linhaDoEquipamento(achado.nome, achado.colB));
        aviso.textContent = '';
        campoNovo.value = '';
    }
}

// ---------- Eventos ----------
caixa.addEventListener('click', evento => {
    const botao = evento.target.closest('.botao-remover');
    if (botao) botao.closest('.linha-edicao').remove();
});

document.getElementById('editar-add-equipamento').addEventListener('click', adicionarEquipamento);

campoNovo.addEventListener('keydown', evento => {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    adicionarEquipamento();
});