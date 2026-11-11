// =============================================================
// acoes-os.js: o que dá para fazer numa OS já lançada
// (por enquanto: trocar ou anexar o PDF. Depois: número novo e editar)
// =============================================================
import { estado } from './estado.js';
import { anexarPDF } from './api.js';
import { problemaNoPDF } from './decisao.js';
import { quemSouEu } from './usuario.js';
import { mostrarAviso } from './util.js';

const dialogo = document.getElementById('dialogo-pdf');
const form = document.getElementById('form-pdf');
const campoArquivo = document.getElementById('pdf-novo');
const nome = document.getElementById('pdf-novo-nome');
const info = document.getElementById('pdf-novo-info');
const alerta = document.getElementById('pdf-novo-alerta');
const aviso = document.getElementById('pdf-novo-aviso');
const botao = document.getElementById('pdf-novo-botao');

let codigoDoPDF = null;   // a OS (ou o apontamento) que está na janela

// O registro na lista mais nova (a lista é trocada a cada atualização)
function registroDoPDF() {
    return estado.lista.find(o => o.codigoTemp === codigoDoPDF);
}

// "11038;11039" → ['11038', '11039']. O apontamento usa o número da OS de origem
function numerosDe(registro) {
    return String(registro.numero_origem || registro.codigoOS || '').split(';').map(n => n.trim()).filter(Boolean);
}

// O texto do botão: troca ou anexa
function textoDoBotao(registro) {
    return registro.pdf_url ? 'Trocar o PDF' : 'Anexar o PDF';
}

// ---------- Abrir a janela (chamado pela aba Ordens de Serviço) ----------
export function abrirTrocaPDF(codigoTemp) {
    codigoDoPDF = codigoTemp;
    const registro = registroDoPDF();
    if (!registro) return;

    const de = registro.tipo_registro === 'LANCAMENTO' ? 'da OS' : 'do apontamento';
    document.getElementById('pdf-titulo').textContent = `${textoDoBotao(registro)} ${de}`;
    document.getElementById('pdf-subtitulo').textContent =
        `OS ${numerosDe(registro).join(' · ')} · ${registro.descricao_fazenda}. `
        + (registro.pdf_url ? 'O novo substitui o atual e o líder é avisado.' : 'O líder é avisado.');

    form.reset();
    nome.textContent = 'Escolher o PDF';
    info.textContent = 'clique ou arraste aqui';
    alerta.textContent = '';
    aviso.textContent = '';
    botao.textContent = textoDoBotao(registro);
    dialogo.showModal();
}

// ---------- Escolheu o arquivo: mostra e confere pelo nome ----------
function aoEscolherArquivo() {
    const registro = registroDoPDF();
    const arquivo = campoArquivo.files[0];
    if (!registro || !arquivo) return;

    nome.textContent = arquivo.name;
    info.textContent = `${Math.round(arquivo.size / 1024)} KB · pronto para enviar`;
    aviso.textContent = '';

    // É mesmo desta OS? (avisa, mas não impede)
    const alertas = [];
    const numeros = numerosDe(registro);
    const numeroDoPDF = arquivo.name.match(/^(?:O\.?\s?S\.?\s*)?(\d{4,6})/i);
    if (numeroDoPDF && numeros.length && !numeros.includes(numeroDoPDF[1])) {
        alertas.push(`O nome do arquivo é da OS ${numeroDoPDF[1]}, mas esta é a OS ${numeros.join(' · ')}.`);
    }
    const faDoPDF = arquivo.name.match(/FA\s*(\d{5,6})/i);
    if (faDoPDF && registro.fa_codigo && faDoPDF[1] !== String(registro.fa_codigo)) {
        alertas.push(`O PDF é da FA ${faDoPDF[1]}, mas esta OS é da FA ${registro.fa_codigo}.`);
    }
    alerta.textContent = alertas.join('\n');
}

// ---------- Enviar ----------
async function enviarPDF() {
    const registro = registroDoPDF();
    if (!registro) return;

    const eu = quemSouEu();
    if (!eu) {
        aviso.textContent = 'Escolha quem você é em "Usuário" (no topo) antes.';
        return;
    }
    const arquivo = campoArquivo.files[0];
    if (!arquivo) {
        aviso.textContent = 'Escolha o PDF primeiro.';
        return;
    }
    const problema = problemaNoPDF(arquivo);
    if (problema) {
        aviso.textContent = problema;
        return;
    }

    const trocou = Boolean(registro.pdf_url);
    botao.disabled = true;
    botao.textContent = 'Enviando…';
    aviso.textContent = '';

    try {
        const resposta = await anexarPDF(registro.codigoTemp, arquivo, eu.nome);
        const atual = registroDoPDF() || registro;   // a lista pode ter chegado de novo enquanto enviava
        atual.pdf_url = resposta.link;
        dialogo.close();
        mostrarAviso(trocou ? 'PDF trocado. O líder foi avisado.' : 'PDF anexado. O líder foi avisado.');
        document.dispatchEvent(new CustomEvent('os-mudou', { detail: atual }));
    } catch (erro) {
        aviso.textContent = 'Não foi possível enviar o PDF: ' + erro.message;
    } finally {
        botao.disabled = false;
        botao.textContent = textoDoBotao(registroDoPDF() || registro);
    }
}

// ---------- Os botões da janela ----------
campoArquivo.addEventListener('change', aoEscolherArquivo);

form.addEventListener('submit', evento => {
    evento.preventDefault();
    enviarPDF();
});

document.getElementById('pdf-fechar').addEventListener('click', () => dialogo.close());