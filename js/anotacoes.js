// =============================================================
// anotacoes.js: anotações da equipe (recados entre os analistas)
// Botão "Anotações" no topo + gaveta que abre pela direita.
// Só quem escreveu pode concluir, reabrir, fixar e editar; os outros só leem.
// =============================================================
import { buscarAnotacoes, anotacao } from './api.js';
import { quemSouEu } from './usuario.js';
import { criar, mostrarAviso } from './util.js';

const botao = document.getElementById('btn-anotacoes');
const contador = document.getElementById('anotacoes-contador');
const bolinha = document.getElementById('anotacoes-nova');
const gaveta = document.getElementById('anotacoes');
const fundo = document.getElementById('anotacoes-fundo');
const texto = document.getElementById('anotacoes-texto');
const letras = document.getElementById('anotacoes-letras');
const fixar = document.getElementById('anotacoes-fixar');
const publicar = document.getElementById('anotacoes-publicar');
const listaAbertas = document.getElementById('lista-abertas');
const listaConcluidas = document.getElementById('lista-concluidas');
const MAX_LETRAS = 1000;

let dados = { abertas: [], concluidas: [], totalConcluidas: 0 };
let aba = 'abertas';
let novasDesde = '';        // ao abrir a gaveta: o que chegou depois disso ganha a etiqueta NOVA
let editando = '';          // id da anotação que está sendo editada (só uma por vez)

// ---------- "Visto por último": guardado no navegador, um por analista ----------
function chaveVisto() {
    const eu = quemSouEu();
    return 'gestao_os_anotacoes_vistas_' + (eu ? eu.id : '');
}
function lerVisto() {
    try { return localStorage.getItem(chaveVisto()) || ''; } catch (e) { return ''; }
}
function guardarVisto() {
    try { localStorage.setItem(chaveVisto(), new Date().toISOString()); } catch (e) { /* só não guarda */ }
}

// ---------- Buscar no servidor ----------
async function carregar() {
    try {
        dados = await buscarAnotacoes();
    } catch (falha) {
        console.warn('Anotações não carregaram:', falha.message);
        return;
    }
    desenharBotao();
    if (!gaveta.hidden && !editando) desenharListas();
}

// ---------- Botão do topo: quantas abertas + bolinha se tem nova de outra pessoa ----------
function desenharBotao() {
    const eu = quemSouEu();
    const visto = lerVisto();
    contador.textContent = dados.abertas.length;
    contador.hidden = dados.abertas.length === 0;
    bolinha.hidden = !dados.abertas.some(a => a.criadaEm > visto && (!eu || a.autorId !== eu.id));
}

// ---------- Abrir e fechar a gaveta ----------
function abrir() {
    novasDesde = lerVisto();
    guardarVisto();
    gaveta.hidden = false;
    fundo.hidden = false;
    botao.setAttribute('aria-expanded', 'true');
    desenharBotao();
    desenharListas();
    texto.focus();
    carregar();
}

function fechar() {
    gaveta.hidden = true;
    fundo.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
    editando = '';
    botao.focus();
}

// ---------- As listas ----------
function desenharListas() {
    const eu = quemSouEu();
    document.getElementById('anotacoes-cont-abertas').textContent = dados.abertas.length;
    document.getElementById('anotacoes-cont-concluidas').textContent = dados.totalConcluidas;

    listaAbertas.replaceChildren(...(dados.abertas.length
        ? dados.abertas.map(a => cartao(a, eu))
        : [criar('p', 'anotacoes-vazio', 'Nenhuma anotação aberta.')]));

    const concluidas = dados.concluidas.map(a => cartao(a, eu));
    if (dados.totalConcluidas > dados.concluidas.length) {
        concluidas.push(criar('p', 'anotacoes-rodape', `Mostrando as ${dados.concluidas.length} mais recentes de ${dados.totalConcluidas} · nada é apagado`));
    }
    listaConcluidas.replaceChildren(...(concluidas.length ? concluidas : [criar('p', 'anotacoes-vazio', 'Nenhuma anotação concluída ainda.')]));
}

function cartao(a, eu) {
    const minha = !!eu && a.autorId === eu.id;
    const concluida = a.situacao === 'CONCLUIDA';
    const caixa = criar('article', 'anotacao' + (a.fixada && !concluida ? ' anotacao-fixada' : '') + (concluida ? ' anotacao-concluida' : ''));
    caixa.dataset.id = a.id;

    // Cabeça: bolinha com as iniciais, nome, quando, e a etiqueta
    const cabeca = criar('div', 'anotacao-cabeca');
    const quem = criar('span', 'anotacao-quem');
    quem.append(criar('strong', '', primeiroNome(a.autorNome)), criar('span', '', quando(a.criadaEm) + (a.editadaEm ? ' · editada' : '')));
    cabeca.append(criar('span', 'anotacao-avatar', iniciais(a.autorNome)), quem);
    if (!concluida && a.fixada) cabeca.append(criar('span', 'anotacao-etiqueta etiqueta-fixada', 'FIXADA'));
    else if (!concluida && a.criadaEm > novasDesde && !minha) cabeca.append(criar('span', 'anotacao-etiqueta etiqueta-nova', 'NOVA'));
    caixa.append(cabeca);

    // Editando: o texto vira um campo
    if (editando === a.id) {
        const campo = criar('textarea', 'anotacao-editar');
        campo.value = a.texto;
        campo.maxLength = MAX_LETRAS;
        campo.setAttribute('aria-label', 'Editar anotação');
        const acoes = criar('div', 'anotacao-acoes');
        acoes.append(botaoAcao('Salvar', 'salvar', true), botaoAcao('Cancelar', 'cancelar'));
        caixa.append(campo, acoes);
        setTimeout(() => campo.focus());
        return caixa;
    }

    caixa.append(criar('p', 'anotacao-texto', a.texto));

    if (concluida) {
        caixa.append(criar('span', 'anotacao-concluida-por', '✓ Concluída ' + quando(a.concluidaEm)));
    }

    // Botões: só para quem escreveu
    if (minha) {
        const acoes = criar('div', 'anotacao-acoes');
        if (concluida) acoes.append(botaoAcao('Reabrir', 'reabrir'));
        else acoes.append(botaoAcao('✓ Concluir', 'concluir', false, 'concluir'), botaoAcao(a.fixada ? 'Desfixar' : 'Fixar', 'fixar'), botaoAcao('Editar', 'editar'));
        caixa.append(acoes);
    }
    return caixa;
}

function botaoAcao(rotulo, acao, principal, extra) {
    const b = criar('button', 'anotacao-acao' + (principal ? ' principal' : '') + (extra ? ' ' + extra : ''), rotulo);
    b.type = 'button';
    b.dataset.acao = acao;
    return b;
}

// "Pamela Neves" → "Pamela" ; "66896-HELOÍSA SANTANA" → "Heloísa"
function primeiroNome(nome) {
    const limpo = String(nome || '').replace(/^\d+\s*-\s*/, '').trim().split(/\s+/)[0] || '—';
    return limpo.charAt(0).toUpperCase() + limpo.slice(1).toLowerCase();
}
function iniciais(nome) {
    const partes = String(nome || '').replace(/^\d+\s*-\s*/, '').trim().split(/\s+/);
    return ((partes[0] || '?').charAt(0) + (partes.length > 1 ? partes[partes.length - 1].charAt(0) : '')).toUpperCase();
}

// "hoje · 16:42", "ontem · 17:30", "seg 23/11 · 08:10"
function quando(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dia = new Date(d); dia.setHours(0, 0, 0, 0);
    const dias = Math.round((hoje - dia) / 86400000);
    if (dias === 0) return 'hoje · ' + hora;
    if (dias === 1) return 'ontem · ' + hora;
    const semana = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return semana + ' ' + d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' · ' + hora;
}

// ---------- Mandar para o servidor (e recarregar a lista) ----------
async function mandar(acao, extra, botaoClicado) {
    const eu = quemSouEu();
    if (!eu) { mostrarAviso('Escolha quem é você em "Usuário" antes.', 'alerta'); return false; }
    if (botaoClicado) botaoClicado.disabled = true;
    try {
        await anotacao(acao, extra, eu);
        await carregar();
        return true;
    } catch (falha) {
        mostrarAviso('Não deu certo: ' + falha.message, 'alerta');
        if (botaoClicado) botaoClicado.disabled = false;
        return false;
    }
}

// ---------- Escrever ----------
function conferirTexto() {
    const n = texto.value.trim().length;
    letras.textContent = n > MAX_LETRAS - 200 ? `${n}/${MAX_LETRAS}` : '';
    publicar.disabled = n === 0 || n > MAX_LETRAS;
}

texto.addEventListener('input', conferirTexto);
texto.addEventListener('keydown', evento => {
    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey) && !publicar.disabled) publicar.click();   // Ctrl+Enter publica
});

document.getElementById('anotacoes-escrever').addEventListener('submit', async evento => {
    evento.preventDefault();
    publicar.textContent = 'Publicando…';
    const deu = await mandar('criar', { texto: texto.value.trim(), fixada: fixar.checked }, publicar);
    publicar.textContent = 'Publicar';
    if (deu) {
        texto.value = '';
        fixar.checked = false;
        guardarVisto();
        trocarAba('abertas');
    }
    conferirTexto();
});

// ---------- Botões dentro dos cartões ----------
gaveta.addEventListener('click', async evento => {
    const b = evento.target.closest('.anotacao-acao');
    if (!b) return;
    const id = b.closest('.anotacao').dataset.id;
    const a = dados.abertas.concat(dados.concluidas).find(x => x.id === id);
    if (!a) return;

    if (b.dataset.acao === 'editar') { editando = id; desenharListas(); return; }
    if (b.dataset.acao === 'cancelar') { editando = ''; desenharListas(); return; }
    if (b.dataset.acao === 'salvar') {
        const novo = b.closest('.anotacao').querySelector('.anotacao-editar').value.trim();
        if (!novo) { mostrarAviso('A anotação não pode ficar vazia.', 'alerta'); return; }
        editando = '';
        if (novo !== a.texto) await mandar('editar', { id, texto: novo }, b);
        desenharListas();
        return;
    }
    if (b.dataset.acao === 'concluir') await mandar('concluir', { id }, b);
    if (b.dataset.acao === 'reabrir') await mandar('reabrir', { id }, b);
    if (b.dataset.acao === 'fixar') await mandar('fixar', { id, fixada: !a.fixada }, b);
});

// ---------- Abas Abertas / Concluídas ----------
function trocarAba(nova) {
    aba = nova;
    for (const b of document.querySelectorAll('.anotacoes-aba')) b.classList.toggle('ativa', b.dataset.lista === aba);
    listaAbertas.hidden = aba !== 'abertas';
    listaConcluidas.hidden = aba !== 'concluidas';
}
document.querySelector('.anotacoes-abas').addEventListener('click', evento => {
    const b = evento.target.closest('.anotacoes-aba');
    if (b) trocarAba(b.dataset.lista);
});

// ---------- Ligações ----------
botao.addEventListener('click', () => (gaveta.hidden ? abrir() : fechar()));
fundo.addEventListener('click', fechar);
document.getElementById('anotacoes-fechar').addEventListener('click', fechar);
document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape' && !gaveta.hidden && !document.querySelector('dialog[open]')) fechar();
});

// A lista de OS chegou de novo (a cada mudança no banco ou 2 minutos): confere as anotações junto
document.addEventListener('lista-atualizada', carregar);
// Trocou o "Usuário": muda quem pode mexer e o que é "nova"
document.addEventListener('eu-sou-mudou', () => { desenharBotao(); if (!gaveta.hidden) desenharListas(); });
document.addEventListener('analistas-mudou', desenharBotao);

carregar();