// =============================================================
// analistas.js: quem é responsável por cada OS (aba ANALISTAS)
// =============================================================
import { buscarAnalistas } from './api.js';
import { estado } from './estado.js';
import { criar } from './util.js';

const CHAVE_BASE = 'gestao_os_analistas';
const CHAVE_ESCOLHA = 'gestao_os_ver_os_de';

let responsavelPorPar = new Map();   // "1046|260101" → { id, nome, todos }
let analistas = [];                  // cada analista uma vez só, em ordem alfabética

// A escolha do "Ver OS de" fica guardada no navegador
try {
    estado.verOSde = new Set(JSON.parse(localStorage.getItem(CHAVE_ESCOLHA)) || []);
} catch (erro) { /* sem escolha guardada: todos */ }

function guardarEscolha() {
    try {
        localStorage.setItem(CHAVE_ESCOLHA, JSON.stringify([...estado.verOSde]));
    } catch (erro) { /* sem espaço: só não guarda */ }
}

// "1046-1 APLIC MEC HERB PRE" → "1046"   |   "260101-TRATOS CANA SOCA" → "260101"
function codigoDoComeco(texto) {
    const achado = String(texto ?? '').trim().match(/^\d+/);
    return achado ? achado[0] : '';
}

// Quem cuida desta OS? (null se a combinação operação + CC não está na base)
export function responsavelDaOS(os) {
    const par = codigoDoComeco(os.operacao) + '|' + codigoDoComeco(os.centro_custo);
    return responsavelPorPar.get(par) || null;
}

// "WELINGTON DO NASCIMENTO ALVES" → "Welington do Nascimento Alves"
const PALAVRAS_MINUSCULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);

function nomeBonito(nome) {
    return String(nome ?? '').trim().toLowerCase().split(/\s+/)
        .map((palavra, i) => i > 0 && PALAVRAS_MINUSCULAS.has(palavra)
            ? palavra
            : palavra.charAt(0).toUpperCase() + palavra.slice(1))
        .join(' ');
}

// Transforma as linhas da base no dicionário "operação|CC → analista"
function montar(linhas) {
    const porId = new Map();
    responsavelPorPar = new Map();

    for (const linha of linhas) {
        if (!porId.has(linha.id)) {
            porId.set(linha.id, { id: linha.id, nome: nomeBonito(linha.nome), todos: false });
        }
        const analista = porId.get(linha.id);
        if (linha.operacao === 'TODOS') analista.todos = true;
        else responsavelPorPar.set(linha.operacao + '|' + linha.cc, analista);
    }
    analistas = [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}

// ---------- A lista com caixinhas do "Ver OS de" ----------
function desenharLista() {
    // Quem saiu da base sai também da escolha
    const validos = new Set(analistas.filter(a => !a.todos).map(a => a.id));
    for (const id of [...estado.verOSde]) {
        if (!validos.has(id)) estado.verOSde.delete(id);
    }

    const todos = item('', 'Todos os analistas', estado.verOSde.size === 0);
    todos.classList.add('multi-todos');
    const itens = [todos];
    for (const analista of analistas) {
        if (!analista.todos) itens.push(item(analista.id, analista.nome, estado.verOSde.has(analista.id)));
    }
    document.getElementById('filtro-analista-lista').replaceChildren(...itens);

    // O texto do botão: "Todos os analistas", "Bruna" ou "Bruna, Pâmela"
    const nomes = analistas.filter(a => estado.verOSde.has(a.id)).map(a => a.nome.split(' ')[0]);
    document.getElementById('filtro-analista-texto').textContent =
        nomes.length === 0 ? 'Todos os analistas' : nomes.join(', ');
}

function item(valor, texto, marcado) {
    const rotulo = criar('label', 'multi-item');
    const caixa = criar('input');
    caixa.type = 'checkbox';
    caixa.value = valor;
    caixa.checked = marcado;
    rotulo.append(caixa, texto);
    return rotulo;
}

// A lista de analistas (para o "Eu sou")
export function analistasDaBase() {
    return analistas;
}

// Troca a escolha do "Ver OS de" pelo código (usado pelo "Eu sou")
export function escolherVerOSde(ids) {
    estado.verOSde = new Set(ids);
    guardarEscolha();
    desenharLista();
    document.dispatchEvent(new CustomEvent('analistas-mudou'));
}

function aplicar(linhas) {
    montar(linhas);
    desenharLista();
    document.dispatchEvent(new CustomEvent('analistas-mudou'));
}

// Ao abrir: usa a base guardada (na hora) e depois busca a atual na planilha
export async function iniciarAnalistas() {
    try {
        const guardada = JSON.parse(localStorage.getItem(CHAVE_BASE));
        if (Array.isArray(guardada)) aplicar(guardada);
    } catch (erro) { /* sem base guardada: segue */ }

    try {
        const linhas = await buscarAnalistas();
        try { localStorage.setItem(CHAVE_BASE, JSON.stringify(linhas)); } catch (erro) { /* sem espaço */ }
        aplicar(linhas);
    } catch (erro) {
        console.warn('Não deu para buscar a base de analistas:', erro.message);
    }
}

// ---------- Marcar e desmarcar ----------
document.getElementById('filtro-analista-lista').addEventListener('change', evento => {
    const caixa = evento.target;
    if (caixa.value === '') estado.verOSde.clear();            // "Todos": desmarca o resto
    else if (caixa.checked) estado.verOSde.add(caixa.value);
    else estado.verOSde.delete(caixa.value);

    guardarEscolha();
    desenharLista();
    document.dispatchEvent(new CustomEvent('analistas-mudou'));
});

// ---------- Fechar a lista: clique fora ou tecla Esc ----------
document.addEventListener('click', evento => {
    const menu = document.getElementById('filtro-analista');
    if (menu.open && !menu.contains(evento.target)) menu.open = false;
});

document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape') document.getElementById('filtro-analista').open = false;
});