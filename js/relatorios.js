// =============================================================
// relatorios.js: enviar os relatórios (PDF) aos líderes, pelo painel
// =============================================================
import { buscarLideres, enviarRelatorio } from './api.js';
import { quemSouEu } from './usuario.js';
import { criar, semAcento, mostrarAviso } from './util.js';

const dialogo = document.getElementById('dialogo-relatorios');
const lista = document.getElementById('relatorios-lista');
const botaoEnviar = document.getElementById('relatorios-enviar');
const erro = document.getElementById('relatorios-erro');

let lideres = null;   // [{ cracha, nome }] da aba de login (carrega uma vez só)
let itens = [];       // um por PDF: { id, arquivo, cracha, status, mensagem }
let enviando = false;
let proximoId = 1;

// ---------- Abrir ----------
async function abrir() {
    if (!quemSouEu()) {
        mostrarAviso('Escolha quem é você em "Usuário" antes de enviar relatórios.', 'alerta');
        return;
    }
    itens = [];
    erro.textContent = '';
    desenhar();
    dialogo.showModal();

    if (lideres) return;
    try {
        lideres = (await buscarLideres()).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        for (const item of itens) {   // PDFs escolhidos enquanto os líderes carregavam
            if (!item.cracha) item.cracha = liderDoArquivo(item.arquivo.name);
        }
        desenhar();
    } catch (falha) {
        erro.textContent = 'Não deu para carregar os líderes. Feche e tente de novo.';
    }
}

// ---------- Achar o líder pelo nome do arquivo ----------

// "Relatório do líder - ELIVELTON CABRAL DOS SANTOS - 30.10.pdf" → "ELIVELTON CABRAL DOS SANTOS"
function nomeNoArquivo(nomeDoArquivo) {
    const achou = nomeDoArquivo.match(/l[íi]der\s*-\s*(.+?)\s*-\s*[\d.]+\s*\.pdf$/i);
    return achou ? achou[1] : '';
}

// Sem acento, minúsculo e sem o crachá na frente ("49767-ELIVELTON..." vira "elivelton...")
function nomeLimpo(nome) {
    return semAcento(nome).replace(/^\d+\s*-\s*/, '').replace(/\s+/g, ' ').trim();
}

// Todos os líderes com esse nome (normalmente 1; pode ter 2 com o mesmo nome)
function lideresComONome(nome) {
    return (lideres || []).filter(l => nomeLimpo(l.nome) === nomeLimpo(nome));
}

// Devolve o crachá do líder, ou '' se não achou ou se o nome é de mais de um
function liderDoArquivo(nomeDoArquivo) {
    const nome = nomeNoArquivo(nomeDoArquivo);
    if (!nome) return '';
    const achados = lideresComONome(nome);
    return achados.length === 1 ? achados[0].cracha : '';
}

// Texto da opção: nome repetido leva o crachá junto, para dar para diferenciar
function textoDoLider(lider) {
    return lideresComONome(lider.nome).length > 1 ? `${lider.nome} (${lider.cracha})` : lider.nome;
}

// ---------- Escolher os PDFs ----------
function adicionar(arquivos) {
    for (const arquivo of arquivos) {
        if (!/\.pdf$/i.test(arquivo.name)) continue;                        // só PDF
        if (itens.some(item => item.arquivo.name === arquivo.name)) continue;   // o mesmo arquivo duas vezes
        itens.push({ id: proximoId++, arquivo, cracha: liderDoArquivo(arquivo.name), status: 'pronto', mensagem: '' });
    }
    desenhar();
}

// ---------- Desenhar a lista ----------
function desenhar() {
    lista.replaceChildren(...itens.map(linha));

    const faltam = itens.filter(item => item.status !== 'enviado');
    const semLider = faltam.filter(item => !item.cracha).length;
    botaoEnviar.disabled = enviando || faltam.length === 0 || semLider > 0;
    document.getElementById('relatorios-fechar').disabled = enviando;
    botaoEnviar.textContent = enviando
        ? 'Enviando…'
        : `Enviar ${faltam.length} relatório${faltam.length === 1 ? '' : 's'}`;
}

function linha(item) {
    const caixa = criar('div', 'relatorio-linha');
    caixa.dataset.id = item.id;

    const select = criar('select', 'relatorio-lider');
    select.append(new Option('Escolha o líder…', ''), ...(lideres || []).map(l => new Option(textoDoLider(l), l.cracha)));
    select.value = item.cracha;
    select.disabled = enviando || item.status === 'enviado';

    const status = criar('span', 'relatorio-status', textoDoStatus(item));
    status.dataset.status = item.status === 'pronto' && !item.cracha ? 'sem-lider' : item.status;
    status.title = item.mensagem;   // o erro completo aparece ao parar o mouse em cima

    const remover = criar('button', 'botao-remover', '×');
    remover.type = 'button';
    remover.title = 'Tirar da lista';
    remover.disabled = enviando;

    const nome = criar('span', 'relatorio-arquivo', item.arquivo.name);
    nome.title = item.arquivo.name;   // o nome inteiro, se não couber

    caixa.append(nome, select, status, remover);
    return caixa;
}

function textoDoStatus(item) {
    if (item.status === 'enviando') return 'enviando…';
    if (item.status === 'enviado') return 'enviado ✓';
    if (item.status === 'erro') return 'não foi enviado';
    return item.cracha ? 'pronto' : 'escolha o líder';
}

// ---------- Enviar (um de cada vez) ----------
async function enviarTodos() {
    const eu = quemSouEu();
    enviando = true;
    erro.textContent = '';
    let enviados = 0;

    for (const item of itens) {
        if (item.status === 'enviado') continue;
        item.status = 'enviando';
        desenhar();
        try {
            await enviarRelatorio(item.cracha, item.arquivo, eu.nome);
            item.status = 'enviado';
            enviados++;
        } catch (falha) {
            item.status = 'erro';
            item.mensagem = falha.message;
        }
        desenhar();
    }

    enviando = false;
    desenhar();
    const falhas = itens.filter(item => item.status === 'erro').length;
    if (falhas) erro.textContent = `${falhas} ${falhas === 1 ? 'não foi enviado' : 'não foram enviados'}. Clique em Enviar para tentar de novo.`;
    if (enviados) mostrarAviso(`${enviados} relatório${enviados === 1 ? '' : 's'} enviado${enviados === 1 ? '' : 's'}. Os líderes recebem o aviso no celular.`);
}

// ---------- Botões ----------
document.getElementById('btn-relatorios').addEventListener('click', abrir);

document.getElementById('relatorios-pdf').addEventListener('change', evento => {
    adicionar(evento.target.files);
    evento.target.value = '';   // permite escolher o mesmo arquivo de novo, se tirar da lista
});

// Trocou o líder de uma linha
lista.addEventListener('change', evento => {
    const select = evento.target.closest('.relatorio-lider');
    if (!select) return;
    const item = itens.find(i => i.id === Number(select.closest('.relatorio-linha').dataset.id));
    item.cracha = select.value;
    if (item.status === 'erro') item.status = 'pronto';
    desenhar();
});

// Tirou uma linha da lista
lista.addEventListener('click', evento => {
    const botao = evento.target.closest('.botao-remover');
    if (!botao) return;
    const id = Number(botao.closest('.relatorio-linha').dataset.id);
    itens = itens.filter(item => item.id !== id);
    desenhar();
});

botaoEnviar.addEventListener('click', enviarTodos);
document.getElementById('relatorios-fechar').addEventListener('click', () => dialogo.close());

// No meio do envio, o Esc não fecha a janela
dialogo.addEventListener('cancel', evento => {
    if (enviando) evento.preventDefault();
});