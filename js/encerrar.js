// =============================================================
// encerrar.js: encerrar ou reabrir uma OS lançada (aba Ordens de Serviço)
// Encerrar: o último apontamento lançado passa a ser o encerramento (o líder esqueceu de marcar).
// Reabrir: o encerramento lançado volta a ser apontamento (a OS foi encerrada por engano).
// =============================================================
import { estado } from './estado.js';
import { encerrarOS, reabrirOS } from './api.js';
import { montarOrdens } from './ordens.js';
import { quemSouEu } from './usuario.js';
import { criar, mostrarAviso, formatarHa, dataCurta } from './util.js';
import { atualizarAgora } from './atualizacao.js';

const dialogo = document.getElementById('dialogo-encerrar');
const form = document.getElementById('form-encerrar');
const texto = document.getElementById('encerrar-texto');
const campoMotivo = document.getElementById('encerrar-campo-motivo');
const motivo = document.getElementById('encerrar-motivo');
const aviso = document.getElementById('encerrar-aviso');
const botao = document.getElementById('encerrar-botao');

const LANCADA = 'OS Lançada';
let codigoDaOS = null;   // a abertura que está na janela
let encerrando = true;   // true = encerrar, false = reabrir
let semApontamento = false;   // encerrar uma OS sem nenhum apontamento lançado

// A OS na lista mais nova (a lista é trocada a cada atualização)
function ordemDaJanela() {
    return montarOrdens(estado.lista).find(o => o.abertura.codigoTemp === codigoDaOS);
}

// "11139;11150" → "OS 11139 · 11150"
function nomeDaOS(abertura) {
    return 'OS ' + String(abertura.codigoOS || '').split(';').map(n => n.trim()).filter(Boolean).join(' · ');
}

// "11/11/2026 15:40 · 25,00 ha"
function resumo(apontamento) {
    return `${dataCurta(apontamento.dataSincronizacao)} · ${formatarHa(apontamento.area_total)}`;
}

function textoDoBotao() {
    return encerrando ? 'Encerrar a OS' : 'Reabrir a OS';
}

// ---------- Abrir a janela (chamado pelo cabeçalho da OS) ----------
export function abrirEncerramento(codigoTemp, encerrar) {
    codigoDaOS = codigoTemp;
    encerrando = encerrar;
    const ordem = ordemDaJanela();
    if (!ordem) return;

    const os = ordem.abertura;
    document.getElementById('encerrar-titulo').textContent = `${encerrar ? 'Encerrar' : 'Reabrir'} a ${nomeDaOS(os)}?`;
    document.getElementById('encerrar-subtitulo').textContent = [os.descricao_fazenda, os.operacao].filter(Boolean).join(' · ');
    form.reset();
    aviso.textContent = '';
    botao.textContent = textoDoBotao();
    botao.className = encerrar ? 'botao-perigo' : 'botao-principal';

    // Os apontamentos já vêm do mais antigo para o mais novo (ordens.js)
    const lancados = ordem.apontamentos.filter(a => a.status_aprovacao === LANCADA);
    const esperando = ordem.apontamentos.filter(a => !a.status_aprovacao || a.status_aprovacao === 'Em análise');
    let pode = true;
    semApontamento = encerrar && lancados.length === 0;

    if (encerrar && esperando.length > 0) {
        // O servidor recusaria: o encerramento tem que ser marcado no que está esperando
        pode = false;
        const ultimo = esperando[esperando.length - 1];
        texto.replaceChildren(
            `Tem ${esperando.length === 1 ? '1 apontamento' : esperando.length + ' apontamentos'} desta OS esperando análise (o último: `,
            criar('strong', '', resumo(ultimo)),
            '). Marque o encerramento nele pelo ✏️ Editar, em Solicitações, ou decida ele antes.'
        );
    } else if (semApontamento) {
        texto.replaceChildren(
            'Esta OS não tem nenhum apontamento lançado. Ao encerrar, será gravado um ',
            criar('strong', '', 'encerramento sem área (0 ha)'),
            ' e a OS fica encerrada. O líder é avisado e não consegue mais apontar nesta OS.'
        );
    } else if (encerrar) {
        const ultimo = lancados[lancados.length - 1];
        texto.replaceChildren(
            'O último apontamento lançado (', criar('strong', '', resumo(ultimo)), ') passa a ser o ',
            criar('strong', '', 'encerramento'),
            '. Nenhum dado do apontamento muda. O líder é avisado e não consegue mais apontar nesta OS.'
        );
    } else {
        const encerramento = lancados.filter(a => a.tipo_registro === 'ENCERRAMENTO').pop();
        texto.replaceChildren(
            'O encerramento lançado (', criar('strong', '', resumo(encerramento)), ') volta a ser um ',
            criar('strong', '', 'apontamento comum'),
            '. Nenhum dado muda. O líder é avisado e pode apontar nesta OS de novo.'
        );
    }
    campoMotivo.hidden = !pode;
    motivo.placeholder = semApontamento ? 'Ex.: o serviço não vai ser feito nesta OS'
        : encerrar ? 'Ex.: líder esqueceu de marcar o encerramento' : 'Ex.: encerrou por engano, ainda falta o talhão 5';
    botao.hidden = !pode;
    dialogo.showModal();
    if (pode) motivo.focus();
}

// ---------- Confirmar ----------
async function confirmar() {
    const eu = quemSouEu();
    if (!eu) {
        aviso.textContent = 'Escolha quem você é em "Usuário" (no topo) antes.';
        return;
    }

    botao.disabled = true;
    botao.textContent = encerrando ? 'Encerrando…' : 'Reabrindo…';
    aviso.textContent = '';
    try {
        const fazer = encerrando ? encerrarOS : reabrirOS;
        const resposta = await fazer(codigoDaOS, motivo.value.trim(), eu.nome);

        // Atualiza a lista na memória, sem esperar a lista nova chegar
        for (const codigo of resposta.alterados || []) {
            const registro = estado.lista.find(o => o.codigoTemp === codigo);
            if (!registro) continue;
            registro.tipo_registro = encerrando ? 'ENCERRAMENTO' : 'APONTAMENTO';
            document.dispatchEvent(new CustomEvent('os-mudou', { detail: registro }));
        }
        // Reabrir uma OS que o controle encerrou sem apontamento: aquele encerramento fica cancelado
        for (const codigo of resposta.cancelados || []) {
            const registro = estado.lista.find(o => o.codigoTemp === codigo);
            if (!registro) continue;
            registro.status_aprovacao = 'Cancelado pelo controle';
            document.dispatchEvent(new CustomEvent('os-mudou', { detail: registro }));
        }
        dialogo.close();
        mostrarAviso(encerrando ? 'OS encerrada. O líder foi avisado.' : 'OS reaberta. O líder foi avisado.');

        // Mostra a OS na aba nova dela (Encerradas ou Abertas)
        const os = codigoDaOS;
        const mostrarOS = () => document.dispatchEvent(new CustomEvent('abrir-ordem', { detail: os }));
        if (resposta.criado) {
            // O encerramento novo (sem apontamento) só chega com a lista nova: espera ela e depois mostra
            document.addEventListener('lista-atualizada', mostrarOS, { once: true });
            atualizarAgora();
        } else {
            mostrarOS();
        }
    } catch (erro) {
        aviso.textContent = (encerrando ? 'Não encerrou: ' : 'Não reabriu: ') + erro.message;
        atualizarAgora();   // a tela pode estar velha (outro analista mexeu nesta OS)
    } finally {
        botao.disabled = false;
        botao.textContent = textoDoBotao();
    }
}

// ---------- Os botões da janela ----------
form.addEventListener('submit', evento => {
    evento.preventDefault();
    confirmar();
});
document.getElementById('encerrar-fechar').addEventListener('click', () => dialogo.close());