// =============================================================
// eusou.js: quem está usando este computador
// =============================================================
import { estado } from './estado.js';
import { analistasDaBase, escolherVerOSde } from './analistas.js';
import { criar } from './util.js';

const CHAVE_EU_SOU = 'gestao_os_eu_sou';

// Quem escolheu da última vez fica guardado no navegador
try {
    estado.euSou = localStorage.getItem(CHAVE_EU_SOU) || '';
} catch (erro) { /* sem acesso: pergunta de novo */ }

// O analista do "Eu sou" (null se ainda não escolheu, ou se saiu da base)
export function quemSouEu() {
    return analistasDaBase().find(a => a.id === estado.euSou) || null;
}

function desenharPilula() {
    const eu = quemSouEu();
    document.getElementById('eu-sou-nome').textContent = eu ? eu.nome.split(' ')[0] : '—';
}

function abrirEscolha() {
    const botoes = analistasDaBase().map(analista => {
        const botao = criar('button', 'escolha-analista', analista.nome);
        botao.type = 'button';
        botao.dataset.id = analista.id;
        if (analista.id === estado.euSou) botao.classList.add('atual');
        return botao;
    });
    document.getElementById('lista-eu-sou').replaceChildren(...botoes);
    document.getElementById('dialogo-eu-sou').showModal();
}

function escolher(id) {
    estado.euSou = id;
    try { localStorage.setItem(CHAVE_EU_SOU, id); } catch (erro) { /* só não guarda */ }

    // Abre na fila de quem escolheu ("TODOS" = vê tudo)
    const eu = quemSouEu();
    escolherVerOSde(eu && !eu.todos ? [eu.id] : []);

    desenharPilula();
    document.getElementById('dialogo-eu-sou').close();
    document.dispatchEvent(new CustomEvent('eu-sou-mudou'));
}

// ---------- Quando a base chega: mostra o nome e, se ninguém escolheu, pergunta ----------
document.addEventListener('analistas-mudou', () => {
    desenharPilula();
    const dialogo = document.getElementById('dialogo-eu-sou');
    if (!quemSouEu() && analistasDaBase().length > 0 && !dialogo.open) abrirEscolha();
});

// ---------- Botões ----------
document.getElementById('btn-eu-sou').addEventListener('click', abrirEscolha);

document.getElementById('lista-eu-sou').addEventListener('click', evento => {
    const botao = evento.target.closest('.escolha-analista');
    if (botao) escolher(botao.dataset.id);
});

// Na primeira vez não dá para fechar sem escolher (Esc não fecha)
document.getElementById('dialogo-eu-sou').addEventListener('cancel', evento => {
    if (!quemSouEu()) evento.preventDefault();
});