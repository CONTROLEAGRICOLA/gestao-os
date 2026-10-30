// =============================================================
// notificacoes.js: avisa quando chega solicitação nova ou reenvio
// =============================================================
import { estado } from './estado.js';
import { tituloDaOS, mostrarAviso } from './util.js';
import { ativarPush } from './push.js';

const CHAVE_REENVIOS = 'gestao_os_reenvios';
const reenvios = lerReenvios();   // códigos das solicitações que voltaram depois de rejeitadas
let naoVistas = 0;                // o número do sino

// ---------- Reenvios guardados no navegador ----------
function lerReenvios() {
    try {
        return new Set(JSON.parse(localStorage.getItem(CHAVE_REENVIOS)) || []);
    } catch (erro) {
        return new Set();
    }
}

function guardarReenvios() {
    try {
        localStorage.setItem(CHAVE_REENVIOS, JSON.stringify([...reenvios]));
    } catch (erro) { /* sem espaço: só não guarda */ }
}

// A fila usa para trocar a etiqueta por REENVIO
export function ehReenvio(os) {
    return os.status_aprovacao === 'Em análise' && reenvios.has(os.codigoTemp);
}

// ---------- Comparar a lista de antes com a de agora ----------
function procurarNovidades(antes, agora) {
    if (antes.length === 0) return { novas: [], voltaram: [] };   // não há com o que comparar

    const statusAntes = new Map(antes.map(os => [os.codigoTemp, os.status_aprovacao]));
    const novas = [];
    const voltaram = [];

    for (const os of agora) {
        if (os.status_aprovacao !== 'Em análise') continue;
        const anterior = statusAntes.get(os.codigoTemp);
        if (anterior === undefined) novas.push(os);
        else if (anterior === 'Rejeitado') voltaram.push(os);
    }
    return { novas, voltaram };
}

// ---------- Sino ----------
function atualizarSino() {
    const sino = document.getElementById('btn-sino');
    if (naoVistas > 0) {
        sino.dataset.contador = naoVistas;
        sino.setAttribute('aria-label', `Notificações: ${naoVistas} novas`);
    } else {
        delete sino.dataset.contador;
        sino.setAttribute('aria-label', 'Notificações');
    }
}

// ---------- Aviso do Windows ----------
function avisarWindows(os, titulo) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.hasFocus()) return;   // o analista já está olhando o painel

    const aviso = new Notification(titulo, {
        body: [tituloDaOS(os), os.descricao_fazenda, os.solicitante_nome].filter(Boolean).join(' · '),
        icon: 'logo.png',
        tag: os.codigoTemp
    });
    aviso.onclick = () => {
        window.focus();
        document.dispatchEvent(new CustomEvent('abrir-os', { detail: os.codigoTemp }));
        aviso.close();
    };
}

// ---------- Quando a lista chega de novo ----------
document.addEventListener('lista-atualizada', evento => {
    const { novas, voltaram } = procurarNovidades(evento.detail.antes, estado.lista);

    // Marca os reenvios e esquece os que já foram resolvidos
    for (const os of voltaram) reenvios.add(os.codigoTemp);
    for (const codigo of reenvios) {
        const os = estado.lista.find(o => o.codigoTemp === codigo);
        if (!os || os.status_aprovacao !== 'Em análise') reenvios.delete(codigo);
    }
    guardarReenvios();

    const total = novas.length + voltaram.length;
    if (total === 0) return;

    naoVistas += total;
    atualizarSino();

    const partes = [];
    if (novas.length) partes.push(`${novas.length} nova${novas.length > 1 ? 's' : ''}`);
    if (voltaram.length) partes.push(`${voltaram.length} reenvio${voltaram.length > 1 ? 's' : ''}`);
    mostrarAviso(`Chegou: ${partes.join(' e ')}.`);

    // No máximo 3 avisos do Windows de uma vez (para não encher a tela)
    for (const os of voltaram.slice(0, 3)) avisarWindows(os, '🔁 Solicitação reenviada');
    for (const os of novas.slice(0, 3)) avisarWindows(os, '🆕 Nova solicitação');
});

// ---------- Clique no sino ----------
document.getElementById('btn-sino').addEventListener('click', () => {
    naoVistas = 0;
    atualizarSino();
    document.querySelector('[data-aba="afazer"]').click();   // vai para Pendentes
    ativarPush();                                              // pede permissão e cadastra o push
});