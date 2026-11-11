// =============================================================
// atualizacao.js: mantém a lista em dia sem precisar recarregar a página
// =============================================================
import { buscarVersao, buscarTodasOS } from './api.js';
import { estado } from './estado.js';

const CHAVE_CACHE = 'gestao_os_lista';
const INTERVALO = 10 * 1000;               // pergunta a versão a cada 10 segundos
const RECARGA_COMPLETA = 2 * 60 * 1000;    // e baixa tudo a cada 2 minutos, por segurança

let versaoAtual = null;
let ultimaCargaCompleta = 0;
let verificando = false;
let verificarDeNovo = false;

// Ao abrir: mostra na hora a última lista guardada no navegador
export function carregarDoCache() {
    try {
        const guardado = JSON.parse(localStorage.getItem(CHAVE_CACHE));
        if (!guardado || !Array.isArray(guardado.lista)) return false;
        estado.lista = guardado.lista;
        versaoAtual = guardado.versao;
        return true;
    } catch (erro) {
        return false;
    }
}

// Começa a vigiar: confere agora, a cada 10 segundos e sempre que chegar um aviso
export function comecarAtualizacao() {
    marcarStatus('carregando');
    verificar();
    setInterval(verificar, INTERVALO);

    // O servidor avisou (push): confere na hora, sem esperar os 10 segundos
    document.addEventListener('push-chegou', verificar);

    // O analista voltou para o painel (estava minimizado): confere na hora
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) verificar();
    });
}

// Confere agora, sem esperar os 10 segundos (ex.: o servidor recusou porque a tela estava velha)
export function atualizarAgora() {
    verificar();
}

async function verificar() {
    if (verificando) {          // já tem uma em andamento: roda de novo quando ela terminar
        verificarDeNovo = true;
        return;
    }
    verificando = true;
    try {
        const versao = await buscarVersao();
        const passouDoTempo = Date.now() - ultimaCargaCompleta > RECARGA_COMPLETA;
        if (versao !== versaoAtual || passouDoTempo) {
            await carregarTudo();
        }
        marcarStatus('ok');
    } catch (erro) {
        console.warn('Atualização falhou:', erro.message);
        marcarStatus('erro');
    } finally {
        verificando = false;
        if (verificarDeNovo) {
            verificarDeNovo = false;
            verificar();
        }
    }
}

async function carregarTudo() {
    const antes = estado.lista;
    const { versao, lista } = await buscarTodasOS();
    estado.lista = lista;
    versaoAtual = versao;
    ultimaCargaCompleta = Date.now();
    guardarNoCache(versao, lista);
    document.dispatchEvent(new CustomEvent('lista-atualizada', { detail: { antes } }));
}

function guardarNoCache(versao, lista) {
    try {
        localStorage.setItem(CHAVE_CACHE, JSON.stringify({ versao, lista }));
    } catch (erro) {
        console.warn('Não deu para guardar a lista no navegador:', erro.message);
    }
}

// O textinho do topo: "Atualizado às 14:32", "Sem conexão…"
function marcarStatus(situacao) {
    // O aviso grande no meio da tela aparece junto com o "Atualizando…" do topo
    document.getElementById('carregando').hidden = situacao !== 'carregando';
    const status = document.getElementById('status-atualizacao');
    status.dataset.situacao = situacao;

    if (situacao === 'ok') {
        const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        status.textContent = `Atualizado às ${hora}`;
    } else if (situacao === 'erro') {
        status.textContent = 'Sem conexão · tentando de novo';
    } else {
        status.textContent = 'Atualizando…';
    }
}