import { desenharFila, marcarSelecionado } from './fila.js';
import { desenharDetalhe } from './detalhe.js';
import { desenharDecisao, atualizarDecisao } from './decisao.js';
import { listaDaFila, contarPorAba } from './filtros.js';
import { carregarDoCache, comecarAtualizacao } from './atualizacao.js';
import { iniciarPush } from './push.js';
import { iniciarAnalistas } from './analistas.js';
import { iniciarVisaoOS } from './visao-os.js';
import './usuario.js';   // liga o "Eu sou"
import './edicao.js';  // liga a edição pelo analista
import './relatorios.js';  // liga o envio de relatórios aos líderes
import { semAcento } from './util.js';
import { estado } from './estado.js';
import { desenharHistorico } from './historico.js';


console.log('Painel novo carregou!');

const NOMES_DAS_ABAS = {
    afazer: 'Pendentes',
    lancadas: 'Lançadas',
    rejeitadas: 'Rejeitadas',
    todas: 'Todas'
};

// OS pedida pela notificação que ainda não chegou na lista (abre assim que chegar)
let abrirQuandoChegar = null;

// Redesenha tudo o que depende dos filtros: fila, título da fila e contadores
function atualizarTela() {
    desenharFila(listaDaFila());

    document.getElementById('fila-titulo').textContent = NOMES_DAS_ABAS[estado.aba];
    document.getElementById('fila-ordem').textContent =
        estado.ordem[estado.aba] === 'antigo' ? 'mais antigo primeiro' : 'mais recente primeiro';

    const contagem = contarPorAba();
    for (const aba in contagem) {
        document.getElementById('cont-' + aba).textContent = contagem[aba];
    }
}

// ---------- Fila: clique abre a OS no detalhe ----------
document.getElementById('fila-lista').addEventListener('click', evento => {
    const item = evento.target.closest('.item-fila');
    if (!item) return;
    abrirOS(item.dataset.codigo);
});

// Abre a OS no detalhe. Devolve false se ela ainda não está na lista.
function abrirOS(codigo) {
    const os = estado.lista.find(o => o.codigoTemp === codigo);
    if (!os) return false;
    estado.selecionada = codigo;
    marcarSelecionado(codigo);
    desenharDetalhe(os);
    desenharDecisao(os);
    desenharHistorico(os);
    return true;
}

// ---------- Uma OS foi lançada ou rejeitada (aviso que vem do decisao.js) ----------
document.addEventListener('os-mudou', evento => {
    const os = evento.detail;
    atualizarTela();
    if (estado.selecionada === os.codigoTemp) {
        desenharDetalhe(os);
        desenharDecisao(os);
        desenharHistorico(os);
    }
});

// ---------- A lista chegou de novo da planilha (aviso que vem do atualizacao.js) ----------
document.addEventListener('lista-atualizada', () => {
    atualizarTela();

    // Clicaram numa notificação de OS que ainda não tinha chegado: abre agora
    if (abrirQuandoChegar && abrirOS(abrirQuandoChegar)) {
        abrirQuandoChegar = null;
        return;
    }

    const aberta = estado.lista.find(o => o.codigoTemp === estado.selecionada);
    if (aberta) {
        desenharDetalhe(aberta);
        atualizarDecisao(aberta);
    }
});

// ---------- Pedido para abrir uma OS (vem do clique na notificação do Windows) ----------
document.addEventListener('abrir-os', evento => {
    if (!abrirOS(evento.detail)) abrirQuandoChegar = evento.detail;   // ainda não chegou: abre quando a lista vier
});

// ---------- A base de analistas chegou, ou mudou o "Ver OS de" ----------
document.addEventListener('analistas-mudou', () => {
    atualizarTela();
    const aberta = estado.lista.find(o => o.codigoTemp === estado.selecionada);
    if (aberta) desenharDetalhe(aberta);   // o "Responsável" do detalhe pode ter mudado
});

// ---------- Abas ----------
document.getElementById('abas').addEventListener('click', evento => {
    const botao = evento.target.closest('.aba');
    if (!botao) return;
    estado.aba = botao.dataset.aba;
    for (const aba of document.querySelectorAll('.aba')) {
        aba.classList.toggle('ativa', aba === botao);
    }
    atualizarTela();
});

// ---------- Chips de tipo (liga/desliga) ----------
document.querySelector('.filtros').addEventListener('click', evento => {
    const chip = evento.target.closest('.chip');
    if (!chip) return;
    const tipo = chip.dataset.tipo;
    if (estado.tipos.has(tipo)) estado.tipos.delete(tipo);
    else estado.tipos.add(tipo);
    chip.setAttribute('aria-pressed', estado.tipos.has(tipo));
    atualizarTela();
});

// ---------- Ordem da fila: clicar troca entre mais antigo e mais recente ----------
const CHAVE_ORDEM = 'gestao_os_ordem';

try {
    Object.assign(estado.ordem, JSON.parse(localStorage.getItem(CHAVE_ORDEM)) || {});
} catch (erro) { /* sem acesso: fica a ordem padrão */ }

document.getElementById('fila-ordem').addEventListener('click', () => {
    estado.ordem[estado.aba] = estado.ordem[estado.aba] === 'antigo' ? 'recente' : 'antigo';
    try { localStorage.setItem(CHAVE_ORDEM, JSON.stringify(estado.ordem)); } catch (erro) { /* só não guarda */ }
    atualizarTela();
});

// ---------- Período ----------
document.getElementById('filtro-periodo').addEventListener('change', evento => {
    estado.periodo = Number(evento.target.value);
    atualizarTela();
});

// ---------- Busca (a cada letra digitada) ----------
document.getElementById('busca').addEventListener('input', evento => {
    estado.busca = semAcento(evento.target.value.trim());
    atualizarTela();
});

// ---------- Começo ----------
if (carregarDoCache()) atualizarTela();   // mostra na hora a última lista guardada
comecarAtualizacao();                     // e busca a atual em segundo plano
iniciarPush();                            // e liga os avisos do servidor (Firebase)
iniciarAnalistas();                       // e carrega quem cuida de cada OS
iniciarVisaoOS();                         // e liga a tela de Ordens de Serviço